// Test helpers for live Supabase integration tests.
// Skipped automatically when SUPABASE_SERVICE_ROLE_KEY is absent (CI without secrets).
//
// USAGE:
//   const url = requireTestEnv("SUPABASE_URL");
//   const session = await mintSessionForEmail(email);
//   await fetchAsRole(url, session.access_token, ...)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function hasIntegrationCredentials(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function requireTestEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing test env: ${key}. See .env.test.example.`);
  return value;
}

export function getServiceClient(): SupabaseClient<Database> {
  const url = requireTestEnv("SUPABASE_URL");
  const key = requireTestEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface SessionPayload {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
}

// Generates a real Supabase session for the given email by minting a
// magic-link admin-side and immediately redeeming it. Same flow the
// pin-login edge function uses internally.
export async function mintSessionForEmail(email: string): Promise<SessionPayload> {
  const url = requireTestEnv("SUPABASE_URL");
  const srk = requireTestEnv("SUPABASE_SERVICE_ROLE_KEY");

  const linkRes = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: srk,
      Authorization: `Bearer ${srk}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email,
      options: { redirect_to: "https://landscapers.tuadministrativa.com" },
    }),
  });
  if (!linkRes.ok) {
    throw new Error(`generate_link failed (${linkRes.status}): ${await linkRes.text()}`);
  }
  const linkData = await linkRes.json();
  const tokenHash = linkData.hashed_token as string | undefined;
  if (!tokenHash) throw new Error("generate_link returned no hashed_token");

  const verifyRes = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: srk, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
  });
  if (!verifyRes.ok) {
    throw new Error(`verify failed (${verifyRes.status}): ${await verifyRes.text()}`);
  }
  return await verifyRes.json();
}

// Returns a Supabase client authenticated as the given user.
// Reads via this client respect RLS as that user.
export async function getClientAsRoleEmail(email: string): Promise<SupabaseClient<Database>> {
  const url = requireTestEnv("SUPABASE_URL");
  const srk = requireTestEnv("SUPABASE_SERVICE_ROLE_KEY");
  const session = await mintSessionForEmail(email);

  const client = createClient<Database>(url, srk, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  return client;
}

// Best-effort cleanup helper for tests that create rows.
export async function cleanupRows(table: "tareas", filter: { column: string; value: string }) {
  const admin = getServiceClient();
  await admin.from(table).delete().eq(filter.column, filter.value);
}
