// ============================================================
// run-migration: PERMANENTLY DISABLED
// ------------------------------------------------------------
// This endpoint previously executed arbitrary SQL via a
// service-role client with NO authentication. It is a critical
// remote-code-execution surface and must never be re-enabled.
//
// We cannot delete the deployed function (deletion in the repo
// does not remove it from Supabase), so instead this handler
// always returns 410 Gone. Use the Supabase CLI for migrations:
//   supabase db push
// ============================================================

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

Deno.serve((req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  return new Response(
    JSON.stringify({
      error: "This endpoint is permanently disabled. Use Supabase CLI for migrations.",
    }),
    {
      status: 410,
      headers: { ...cors, "Content-Type": "application/json" },
    },
  );
});
