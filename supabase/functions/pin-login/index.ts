// ============================================================
// pin-login: secure PIN-based session creation
// ------------------------------------------------------------
// - Requires 6-digit PIN
// - Verifies bcrypt-hashed pin_hash; falls back ONCE to legacy
//   plaintext `pin` column then silently rehashes on success
// - Rate-limits per IP (10 attempts / 15 min) via pin_login_attempts
// - Forbids PIN login for admin/dueno roles
// - Audit logs every attempt to auth_attempts
// - Uses generateLink + /auth/v1/verify to mint a real session
//   (auth.admin.createSession() was removed from supabase-js)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import bcrypt from "npm:bcryptjs@2.4.3";

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

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

async function logAttempt(
  admin: ReturnType<typeof createClient>,
  ip: string,
  userId: string | null,
  success: boolean,
  reason: string,
) {
  try {
    await admin.from("auth_attempts").insert({
      ip,
      user_id: userId,
      success,
      reason,
    });
  } catch (_e) { /* never block on audit-log failure */ }
  try {
    await admin.from("pin_login_attempts").insert({ ip });
  } catch (_e) { /* never block on rate-counter failure */ }
}

async function mintSessionForUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number; expires_at: number; token_type: string; user: unknown } | null> {
  // Step 1: generate a one-time magiclink for this user
  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email,
      options: { redirect_to: "https://landscapers.tuadministrativa.com" },
    }),
  });
  if (!linkRes.ok) {
    console.error("generate_link failed:", linkRes.status, await linkRes.text());
    return null;
  }
  const linkData = await linkRes.json();
  const tokenHash = linkData.hashed_token as string | undefined;
  if (!tokenHash) {
    console.error("generate_link returned no hashed_token");
    return null;
  }

  // Step 2: redeem the magiclink token to get a session
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "apikey": serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      token_hash: tokenHash,
    }),
  });
  if (!verifyRes.ok) {
    console.error("verify failed:", verifyRes.status, await verifyRes.text());
    return null;
  }
  return await verifyRes.json();
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const ip = clientIp(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // --- rate limit -----------------------------------------
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: attemptCount } = await admin
      .from("pin_login_attempts")
      .select("ip", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("attempted_at", since);

    if ((attemptCount ?? 0) >= 10) {
      await logAttempt(admin, ip, null, false, "rate_limited");
      return new Response(
        JSON.stringify({ error: "Demasiados intentos. Inténtalo más tarde." }),
        {
          status: 429,
          headers: {
            ...cors,
            "Content-Type": "application/json",
            "Retry-After": "900",
          },
        },
      );
    }

    // --- input validation -----------------------------------
    let body: { pin?: unknown };
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const pin = body.pin;

    if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
      await logAttempt(admin, ip, null, false, "invalid_pin_format");
      return new Response(
        JSON.stringify({ error: "PIN must be 6 digits" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // --- lookup ---------------------------------------------
    let profile: { id: string; email: string | null; pin_hash: string | null; pin: string | null } | null = null;

    // Legacy fast-path: plaintext column still set and matches
    const { data: legacyMatch } = await admin
      .from("profiles")
      .select("id, email, pin_hash, pin")
      .eq("pin", pin)
      .maybeSingle();

    if (legacyMatch) {
      profile = legacyMatch as typeof profile;
    } else {
      // Hashed path: scan profiles that have a pin_hash and bcrypt-compare
      const { data: hashed } = await admin
        .from("profiles")
        .select("id, email, pin_hash, pin")
        .not("pin_hash", "is", null);

      if (hashed && hashed.length > 0) {
        for (const row of hashed) {
          if (!row.pin_hash) continue;
          try {
            const match = await bcrypt.compare(pin, row.pin_hash);
            if (match) {
              profile = row as typeof profile;
              break;
            }
          } catch (e) {
            console.error("bcrypt.compare error:", e);
            // continue to next row
          }
        }
      }
    }

    if (!profile) {
      await logAttempt(admin, ip, null, false, "no_match");
      return new Response(
        JSON.stringify({ error: "PIN incorrecto" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // --- forbid admin/dueno PIN login -----------------------
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (roleRow && (roleRow.role === "admin" || roleRow.role === "dueno")) {
      await logAttempt(admin, ip, profile.id, false, "admin_pin_blocked");
      // Same generic message to avoid leaking which accounts are admin
      return new Response(
        JSON.stringify({ error: "PIN incorrecto" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // --- one-shot rehash for legacy plaintext profiles ------
    if (!profile.pin_hash && profile.pin) {
      try {
        const newHash = await bcrypt.hash(pin);
        await admin
          .from("profiles")
          .update({ pin_hash: newHash, pin: null })
          .eq("id", profile.id);
      } catch (e) {
        console.error("legacy rehash failed", e);
        // do not block login on rehash failure
      }
    }

    // --- create session via generateLink + verify -----------
    if (!profile.email) {
      await logAttempt(admin, ip, profile.id, false, "no_email_on_profile");
      return new Response(
        JSON.stringify({ error: "Error interno: usuario sin email" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const session = await mintSessionForUser(supabaseUrl, serviceRoleKey, profile.email);
    if (!session) {
      await logAttempt(admin, ip, profile.id, false, "session_create_error");
      return new Response(
        JSON.stringify({ error: "Error al crear sesión" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    await logAttempt(admin, ip, profile.id, true, "ok");
    return new Response(
      JSON.stringify({ session }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    try {
      await logAttempt(admin, ip, null, false, "exception");
    } catch (_e) { /* ignore */ }
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
