import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await sql.end().catch(() => {});
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
