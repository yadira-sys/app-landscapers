import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await client.rpc("exec_sql", { sql: "ALTER TABLE public.presupuestos ADD COLUMN IF NOT EXISTS imagenes jsonb DEFAULT '[]'::jsonb" }).single().catch(() => ({ error: null }));
  // Try direct approach via pg_catalog
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json", "apikey": Deno.env.get("SUPABASE_ANON_KEY")! },
    body: JSON.stringify({ sql: "ALTER TABLE public.presupuestos ADD COLUMN IF NOT EXISTS imagenes jsonb DEFAULT '[]'::jsonb" })
  });
  return new Response(JSON.stringify({ status: res.status, text: await res.text() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
