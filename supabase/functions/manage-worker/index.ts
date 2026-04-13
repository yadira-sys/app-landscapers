import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is admin/dueno
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client with caller's token to check role
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("No autenticado");

    // Check caller role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!roleData || (roleData.role !== "admin" && roleData.role !== "dueno")) {
      throw new Error("Sin permisos");
    }

    const { action, ...payload } = await req.json();

    if (action === "create") {
      const { email, password, full_name, role, pin } = payload;
      if (!full_name) throw new Error("Nombre obligatorio");

      const finalEmail = email?.trim() || `${crypto.randomUUID().slice(0, 8)}@interno.landscapers.local`;
      const finalPassword = password?.trim() || crypto.randomUUID();

      if (role !== "jardinero" && (!email?.trim() || !password?.trim())) {
        throw new Error("Email y contraseña son obligatorios para este rol");
      }

      // Validate PIN uniqueness before creating user (if PIN provided)
      if (pin && /^\d{4,6}$/.test(pin)) {
        const { data: existing } = await adminClient
          .from("profiles").select("id").eq("pin", pin).maybeSingle();
        if (existing) throw new Error("Este PIN ya está en uso");
      }

      // Create auth user (trigger creates profile row)
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: finalEmail,
        password: finalPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) throw createError;

      // Ensure profile exists immediately (no dependency on DB trigger)
      const { error: profileUpsertError } = await adminClient
        .from("profiles")
        .upsert(
          {
            id: newUser.user.id,
            full_name: full_name.trim(),
            email: finalEmail,
          },
          { onConflict: "id" }
        );
      if (profileUpsertError) throw profileUpsertError;

      // Set role + PIN in parallel
      const promises: Promise<any>[] = [
        adminClient.from("user_roles").insert({ user_id: newUser.user.id, role }),
      ];
      if (pin && /^\d{4,6}$/.test(pin)) {
        promises.push(adminClient.from("profiles").update({ pin }).eq("id", newUser.user.id));
      }
      await Promise.all(promises);

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = payload;
      if (!user_id) throw new Error("user_id requerido");

      // Prevent self-deletion
      if (user_id === caller.id) throw new Error("No puedes eliminarte a ti mismo");

      // Clean up related records that may not cascade automatically
      await adminClient.from("jornadas").delete().eq("jardinero_id", user_id);
      await adminClient.from("asignaciones").delete().eq("jardinero_id", user_id);
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("id", user_id);

      // Delete auth user
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { user_id, role } = payload;
      if (!user_id || !role) throw new Error("user_id y role requeridos");

      await adminClient
        .from("user_roles")
        .update({ role })
        .eq("user_id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_profile") {
      const { user_id, full_name, email } = payload;
      if (!user_id) throw new Error("user_id requerido");
      if (!full_name?.trim() && !email?.trim()) throw new Error("Nada que actualizar");

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

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_pin") {
      const { user_id, pin } = payload;
      if (!user_id) throw new Error("user_id requerido");

      // pin can be null (remove) or a 4-6 digit string (set)
      if (pin !== null && pin !== undefined) {
        if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
          throw new Error("El PIN debe tener entre 4 y 6 dígitos");
        }
        // Check uniqueness
        const { data: existing } = await adminClient
          .from("profiles")
          .select("id")
          .eq("pin", pin)
          .neq("id", user_id)
          .maybeSingle();
        if (existing) throw new Error("Este PIN ya está en uso por otro trabajador");
      }

      const { error: pinError } = await adminClient
        .from("profiles")
        .update({ pin: pin ?? null })
        .eq("id", user_id);
      if (pinError) throw pinError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Acción no válida");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
