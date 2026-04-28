// ============================================================
// manage-worker: admin-gated worker CRUD with hashed PIN storage
// ------------------------------------------------------------
// - Strict CORS allow-list
// - zod payload validation per action
// - PIN values are bcrypt-hashed before storage (pin_hash column);
//   plaintext `pin` column is always cleared on write
// - update_role: forbids self-role-change; protects dueno from
//   non-dueno downgrade; logs to role_change_log
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ALLOWED_ORIGINS = new Set<string>([
  Deno.env.get("ALLOWED_ORIGIN") ?? "https://landscapers.tuadministrativa.com",
  "https://landscapers.tuadministrativa.com",
  "http://localhost:5173",
  "http://localhost:8080",
]);

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin)
    ? origin
    : (Deno.env.get("ALLOWED_ORIGIN") ?? "https://landscapers.tuadministrativa.com");
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const RoleEnum = z.enum(["jardinero", "admin", "dueno"]);
const PinSchema = z.string().regex(/^\d{6}$/, "PIN must be 6 digits");

const CreateSchema = z.object({
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  password: z.string().min(8).optional().or(z.literal("").transform(() => undefined)),
  full_name: z.string().min(1).max(120),
  role: RoleEnum,
  pin: PinSchema.optional().nullable(),
});

const DeleteSchema = z.object({ user_id: z.string().uuid() });

const UpdateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: RoleEnum,
});

const UpdateProfileSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
});

const UpdatePinSchema = z.object({
  user_id: z.string().uuid(),
  pin: PinSchema.nullable().optional(),
});

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "No autenticado" }, 401, cors);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return jsonResponse({ error: "No autenticado" }, 401, cors);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerRoleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    const callerRole = callerRoleData?.role as string | undefined;
    if (!callerRole || (callerRole !== "admin" && callerRole !== "dueno")) {
      return jsonResponse({ error: "Sin permisos" }, 403, cors);
    }

    let raw: { action?: string; [k: string]: unknown };
    try {
      raw = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido" }, 400, cors);
    }
    const action = raw.action;
    const payload = { ...raw };
    delete (payload as Record<string, unknown>).action;

    // ---- create -----------------------------------------------
    if (action === "create") {
      const parsed = CreateSchema.safeParse(payload);
      if (!parsed.success) {
        return jsonResponse(
          { error: "Datos inválidos", details: parsed.error.flatten() },
          400,
          cors,
        );
      }
      const { email, password, full_name, role, pin } = parsed.data;

      const finalEmail = email?.trim() || `${crypto.randomUUID().slice(0, 8)}@interno.landscapers.local`;
      const finalPassword = password?.trim() || crypto.randomUUID();

      if (role !== "jardinero" && (!email?.trim() || !password?.trim())) {
        return jsonResponse(
          { error: "Email y contraseña son obligatorios para este rol" },
          400,
          cors,
        );
      }

      // Hash PIN now so we can probe uniqueness against existing hashes
      let pinHash: string | null = null;
      if (pin) {
        // Reject duplicate plaintext (legacy column) and duplicate hash (new column).
        const { data: legacyDup } = await adminClient
          .from("profiles").select("id").eq("pin", pin).maybeSingle();
        if (legacyDup) return jsonResponse({ error: "Este PIN ya está en uso" }, 409, cors);

        const { data: hashed } = await adminClient
          .from("profiles").select("pin_hash").not("pin_hash", "is", null);
        if (hashed) {
          for (const row of hashed) {
            if (row.pin_hash && await bcrypt.compare(pin, row.pin_hash)) {
              return jsonResponse({ error: "Este PIN ya está en uso" }, 409, cors);
            }
          }
        }
        pinHash = await bcrypt.hash(pin);
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: finalEmail,
        password: finalPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) throw createError;

      const { error: profileUpsertError } = await adminClient
        .from("profiles")
        .upsert(
          {
            id: newUser.user.id,
            full_name: full_name.trim(),
            email: finalEmail,
            pin: null,
            pin_hash: pinHash,
          },
          { onConflict: "id" },
        );
      if (profileUpsertError) throw profileUpsertError;

      // Service role bypasses RLS, so this insert still works despite
      // the WITH CHECK (false) policy added in the hardening migration.
      await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role });

      return jsonResponse({ success: true, user_id: newUser.user.id }, 200, cors);
    }

    // ---- delete -----------------------------------------------
    if (action === "delete") {
      const parsed = DeleteSchema.safeParse(payload);
      if (!parsed.success) {
        return jsonResponse({ error: "user_id inválido" }, 400, cors);
      }
      const { user_id } = parsed.data;
      if (user_id === caller.id) {
        return jsonResponse({ error: "No puedes eliminarte a ti mismo" }, 400, cors);
      }

      await adminClient.from("jornadas").delete().eq("jardinero_id", user_id);
      await adminClient.from("asignaciones").delete().eq("jardinero_id", user_id);
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("id", user_id);

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) throw deleteError;

      return jsonResponse({ success: true }, 200, cors);
    }

    // ---- update_role ------------------------------------------
    if (action === "update_role") {
      const parsed = UpdateRoleSchema.safeParse(payload);
      if (!parsed.success) {
        return jsonResponse({ error: "Datos inválidos" }, 400, cors);
      }
      const { user_id, role: newRole } = parsed.data;

      if (user_id === caller.id) {
        return jsonResponse(
          { error: "No puedes cambiar tu propio rol" },
          400,
          cors,
        );
      }

      const { data: targetRoleRow } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id)
        .maybeSingle();
      const fromRole = (targetRoleRow?.role as string | undefined) ?? null;

      if (fromRole === "dueno" && newRole !== "dueno" && callerRole !== "dueno") {
        return jsonResponse(
          { error: "Solo un dueño puede degradar a otro dueño" },
          403,
          cors,
        );
      }

      const { error: updateErr } = await adminClient
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", user_id);
      if (updateErr) throw updateErr;

      await adminClient.from("role_change_log").insert({
        actor_id: caller.id,
        target_user_id: user_id,
        from_role: fromRole,
        to_role: newRole,
      });

      return jsonResponse({ success: true }, 200, cors);
    }

    // ---- update_profile ---------------------------------------
    if (action === "update_profile") {
      const parsed = UpdateProfileSchema.safeParse(payload);
      if (!parsed.success) {
        return jsonResponse({ error: "Datos inválidos" }, 400, cors);
      }
      const { user_id, full_name, email } = parsed.data;
      if (!full_name?.trim() && !email?.trim()) {
        return jsonResponse({ error: "Nada que actualizar" }, 400, cors);
      }

      const updates: Record<string, string> = {};
      if (full_name?.trim()) updates.full_name = full_name.trim();
      if (email?.trim()) updates.email = email.trim();

      const { error: profileError } = await adminClient
        .from("profiles")
        .update(updates)
        .eq("id", user_id);
      if (profileError) throw profileError;

      if (email?.trim()) {
        const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, {
          email: email.trim(),
        });
        if (authError) throw authError;
      }
      if (full_name?.trim()) {
        const { error: metaError } = await adminClient.auth.admin.updateUserById(user_id, {
          user_metadata: { full_name: full_name.trim() },
        });
        if (metaError) throw metaError;
      }

      return jsonResponse({ success: true }, 200, cors);
    }

    // ---- update_pin -------------------------------------------
    if (action === "update_pin") {
      const parsed = UpdatePinSchema.safeParse(payload);
      if (!parsed.success) {
        return jsonResponse(
          { error: "El PIN debe tener 6 dígitos" },
          400,
          cors,
        );
      }
      const { user_id, pin } = parsed.data;

      if (pin === null || pin === undefined) {
        const { error: clearErr } = await adminClient
          .from("profiles")
          .update({ pin: null, pin_hash: null })
          .eq("id", user_id);
        if (clearErr) throw clearErr;
        return jsonResponse({ success: true }, 200, cors);
      }

      // Uniqueness check across both legacy and hashed storage
      const { data: legacyDup } = await adminClient
        .from("profiles")
        .select("id")
        .eq("pin", pin)
        .neq("id", user_id)
        .maybeSingle();
      if (legacyDup) {
        return jsonResponse(
          { error: "Este PIN ya está en uso por otro trabajador" },
          409,
          cors,
        );
      }

      const { data: hashed } = await adminClient
        .from("profiles")
        .select("id, pin_hash")
        .neq("id", user_id)
        .not("pin_hash", "is", null);
      if (hashed) {
        for (const row of hashed) {
          if (row.pin_hash && await bcrypt.compare(pin, row.pin_hash)) {
            return jsonResponse(
              { error: "Este PIN ya está en uso por otro trabajador" },
              409,
              cors,
            );
          }
        }
      }

      const pinHash = await bcrypt.hash(pin);
      const { error: pinError } = await adminClient
        .from("profiles")
        .update({ pin: null, pin_hash: pinHash })
        .eq("id", user_id);
      if (pinError) throw pinError;

      return jsonResponse({ success: true }, 200, cors);
    }

    return jsonResponse({ error: "Acción no válida" }, 400, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return jsonResponse({ error: message }, 400, cors);
  }
});
