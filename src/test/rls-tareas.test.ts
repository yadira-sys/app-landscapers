// Verifies tareas RLS uses is_team_lead (admin/dueno/encargado) for write
// operations, and assignee-or-team-lead for select.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  hasIntegrationCredentials,
  getClientAsRoleEmail,
  cleanupRows,
} from "./helpers/supabase";

const skip = !hasIntegrationCredentials();
const ENCARGADO_EMAIL = process.env.TEST_ENCARGADO_EMAIL ?? "";
const JARDINERO_EMAIL = process.env.TEST_JARDINERO_EMAIL ?? "";
const TEST_TAREA_NAME = "__VITEST_RLS_TAREAS__";

describe.skipIf(skip || !ENCARGADO_EMAIL || !JARDINERO_EMAIL)(
  "RLS: tareas (team_lead policies)",
  () => {
    let encargadoClient: SupabaseClient<Database>;
    let jardineroClient: SupabaseClient<Database>;
    let jardineroId: string | null = null;

    beforeAll(async () => {
      // Mint sessions sequentially to avoid generate_link race / OTP expiry.
      encargadoClient = await getClientAsRoleEmail(ENCARGADO_EMAIL);
      jardineroClient = await getClientAsRoleEmail(JARDINERO_EMAIL);
      jardineroId = (await jardineroClient.auth.getUser()).data.user?.id ?? null;
    });

    afterAll(async () => {
      await cleanupRows("tareas", { column: "nombre", value: TEST_TAREA_NAME });
    });

    it("encargado can SELECT all tareas", async () => {
      const { data, error } = await encargadoClient.from("tareas").select("id");
      expect(error).toBeNull();
      // Production has many tareas; just verify it's not empty (proves
      // is_team_lead() works for encargado).
      expect((data ?? []).length).toBeGreaterThan(5);
    });

    it("encargado can INSERT a tarea", async () => {
      const { data, error } = await encargadoClient
        .from("tareas")
        .insert({ nombre: TEST_TAREA_NAME, estado: "pendiente" })
        .select("id")
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
    });

    it("jardinero CANNOT INSERT a tarea (RLS denies)", async () => {
      const { error } = await jardineroClient
        .from("tareas")
        .insert({ nombre: "__JARDINERO_HACK__", estado: "pendiente" });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("jardinero sees only their assigned tareas (not all)", async () => {
      const { data, error } = await jardineroClient.from("tareas").select("id, asignado_a");
      expect(error).toBeNull();
      expect(jardineroId).toBeTruthy();
      for (const t of data ?? []) {
        expect(t.asignado_a).toBe(jardineroId);
      }
    });
  },
);
