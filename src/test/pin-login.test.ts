// Live integration test for the pin-login edge function.
// Hits the deployed function in production. Skipped when service-role
// credentials are missing.
import { describe, it, expect, beforeAll } from "vitest";
import { hasIntegrationCredentials, requireTestEnv, getServiceClient } from "./helpers/supabase";

const skip = !hasIntegrationCredentials();
const PIN = process.env.TEST_JARDINERO_PIN ?? "";

describe.skipIf(skip)("pin-login edge function", () => {
  let url: string;
  let apikey: string;

  beforeAll(async () => {
    url = requireTestEnv("SUPABASE_URL");
    apikey = requireTestEnv("SUPABASE_SERVICE_ROLE_KEY");
    // Clear rate-limit residue so repeated runs don't hit the 10/15min cap.
    const admin = getServiceClient();
    await admin
      .from("pin_login_attempts")
      .delete()
      .gte("attempted_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  });

  async function callPinLogin(pin: string) {
    return await fetch(`${url}/functions/v1/pin-login`, {
      method: "POST",
      headers: {
        apikey,
        Authorization: `Bearer ${apikey}`,
        "Content-Type": "application/json",
        Origin: "https://landscapers.tuadministrativa.com",
      },
      body: JSON.stringify({ pin }),
    });
  }

  it("rejects empty PIN with 400", async () => {
    const res = await callPinLogin("");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/6 digits/i);
  });

  it("rejects 4-digit PIN with 400", async () => {
    const res = await callPinLogin("0000");
    expect(res.status).toBe(400);
  });

  it("rejects 6-digit non-existent PIN with 401", async () => {
    const res = await callPinLogin("000001");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/incorrecto/i);
  });

  it.skipIf(!PIN)("accepts valid 6-digit PIN and returns a session", async () => {
    const res = await callPinLogin(PIN);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session?.access_token).toBeTruthy();
    expect(body.session?.refresh_token).toBeTruthy();
    expect(body.session?.user?.id).toBeTruthy();
  });
});
