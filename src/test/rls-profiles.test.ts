// Verifies RLS on profiles after the team_lead/peer migration.
// Regression test for the bug where encargados saw empty lists and
// jardineros couldn't see compañeros.
import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hasIntegrationCredentials, getClientAsRoleEmail } from "./helpers/supabase";

const skip = !hasIntegrationCredentials();
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "";
const ENCARGADO_EMAIL = process.env.TEST_ENCARGADO_EMAIL ?? "";
const JARDINERO_EMAIL = process.env.TEST_JARDINERO_EMAIL ?? "";

describe.skipIf(skip || !ADMIN_EMAIL || !ENCARGADO_EMAIL || !JARDINERO_EMAIL)(
  "RLS: profiles_select_team_or_self",
  () => {
    let adminClient: SupabaseClient<Database>;
    let encargadoClient: SupabaseClient<Database>;
    let jardineroClient: SupabaseClient<Database>;

    beforeAll(async () => {
      adminClient = await getClientAsRoleEmail(ADMIN_EMAIL);
      encargadoClient = await getClientAsRoleEmail(ENCARGADO_EMAIL);
      jardineroClient = await getClientAsRoleEmail(JARDINERO_EMAIL);
    });

    it("admin sees all profiles", async () => {
      const { data, error } = await adminClient.from("profiles").select("id, full_name");
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(8);
    });

    it("encargado sees all profiles (admins included)", async () => {
      const { data, error } = await encargadoClient.from("profiles").select("id, full_name");
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(8);
    });

    it("jardinero sees only team peers, NOT all profiles", async () => {
      const { data: jData, error: jErr } = await jardineroClient
        .from("profiles")
        .select("id, full_name");
      expect(jErr).toBeNull();
      const jardineroVisible = jData ?? [];

      const { data: aData } = await adminClient.from("profiles").select("id");
      const adminTotal = (aData ?? []).length;

      // Jardinero must see strictly fewer profiles than admin (admins hidden).
      expect(jardineroVisible.length).toBeLessThan(adminTotal);
      expect(jardineroVisible.length).toBeGreaterThan(0);
    });
  },
);
