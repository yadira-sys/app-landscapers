// ============================================================
// setup-storage: admin-gated storage bootstrap
// ------------------------------------------------------------
// - Strict CORS allow-list
// - Caller must hold admin or dueno role
// - Idempotent: uses CREATE POLICY IF NOT EXISTS pattern
// ============================================================

import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

  // --- auth gate -------------------------------------------------
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
  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .maybeSingle();
  const role = roleRow?.role as string | undefined;
  if (!role || (role !== "admin" && role !== "dueno")) {
    return jsonResponse({ error: "Sin permisos" }, 403, cors);
  }

  // --- privileged work -------------------------------------------
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  const sql = postgres(dbUrl);
  try {
    await sql`
      CREATE POLICY IF NOT EXISTS "auth_users_can_upload_presupuestos"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'presupuestos' AND auth.role() = 'authenticated')
    `;
    await sql`
      CREATE POLICY IF NOT EXISTS "auth_users_can_delete_presupuestos"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'presupuestos' AND auth.role() = 'authenticated')
    `;
    await sql.end();
    return jsonResponse({ ok: true }, 200, cors);
  } catch (e) {
    await sql.end().catch(() => {});
    const message = e instanceof Error ? e.message : "Error desconocido";
    return jsonResponse({ error: message }, 400, cors);
  }
});
