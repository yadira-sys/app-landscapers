// Regression tests for the "se queda pillada" (stuck loading) bug.
//
// For each role we render representative pages with a mocked Supabase client.
//   - happy path: queries resolve -> the loading spinner disappears and the
//     page reaches a stable rendered state (empty list / content).
//   - error path: queries fail -> the page shows the QueryError UI with a
//     "Reintentar" button. The key guarantee is that it does NOT stay on a
//     spinner forever (waitFor would time out and fail the test if it did).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./helpers/render";

// Mutable mock state, shared with the hoisted vi.mock factories below.
const h = vi.hoisted(() => ({
  mode: "ok" as "ok" | "error",
  auth: {} as Record<string, unknown>,
}));

// Chainable, awaitable Supabase query builder. Every chain method returns the
// same object; awaiting it yields { data, error, count } based on h.mode.
vi.mock("@/integrations/supabase/client", () => {
  const result = () =>
    h.mode === "error"
      ? { data: null, error: { message: "Network error (test)" }, count: null }
      : { data: [], error: null, count: 0 };

  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const passthrough = ["select", "eq", "neq", "gte", "lte", "not", "is", "in", "order", "limit", "single", "maybeSingle", "insert", "update", "delete"];
    for (const m of passthrough) chain[m] = () => chain;
    chain.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(onF, onR);
    chain.catch = (onR: (e: unknown) => unknown) => Promise.resolve(result()).catch(onR);
    chain.finally = (onF: () => void) => Promise.resolve(result()).finally(onF);
    return chain;
  };

  return {
    supabase: {
      from: () => makeChain(),
      storage: {
        from: () => ({
          list: () => Promise.resolve({ data: [], error: null }),
          upload: () => Promise.resolve({ data: null, error: null }),
          remove: () => Promise.resolve({ data: null, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        }),
      },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => h.auth,
}));

import RegistroHoras from "@/pages/shared/RegistroHoras";
import TrabajosExtras from "@/pages/shared/TrabajosExtras";
import ResumenEncargado from "@/pages/encargado/ResumenEncargado";
import Dashboard from "@/pages/admin/Dashboard";
import GestionTrabajadores from "@/pages/admin/GestionTrabajadores";
import GestionJardines from "@/pages/admin/GestionJardines";
import Tareas from "@/pages/admin/Tareas";
import ControlHorario from "@/pages/admin/ControlHorario";
import Presupuestos from "@/pages/admin/Presupuestos";
import HistorialJardinero from "@/pages/jardinero/HistorialJardinero";
import IncidenciasJardinero from "@/pages/jardinero/IncidenciasJardinero";

const jardinero = { user: { id: "u-jard" }, role: "jardinero", profile: { full_name: "Jardin" }, isAdmin: false, isEncargado: false, isJardinero: true };
const encargado = { user: { id: "u-enc" }, role: "encargado", profile: { full_name: "Enc" }, isAdmin: false, isEncargado: true, isJardinero: false };
const admin = { user: { id: "u-adm" }, role: "admin", profile: { full_name: "Adm" }, isAdmin: true, isEncargado: false, isJardinero: false };

beforeEach(() => {
  h.mode = "ok";
  h.auth = {};
});

describe("no infinite loading per role", () => {
  it("Jardinero · RegistroHoras loads without hanging", async () => {
    h.auth = jardinero;
    renderWithProviders(<RegistroHoras />);
    await waitFor(() => expect(screen.getByText("No hay registros de horas.")).toBeInTheDocument());
    expect(screen.queryByTestId("query-error")).not.toBeInTheDocument();
  });

  it("Jardinero · RegistroHoras shows error UI (not a spinner) when the query fails", async () => {
    h.auth = jardinero;
    h.mode = "error";
    renderWithProviders(<RegistroHoras />);
    await waitFor(() => expect(screen.getByTestId("query-error")).toBeInTheDocument());
    expect(screen.getByText("Reintentar")).toBeInTheDocument();
  });

  it("Jardinero · TrabajosExtras loads without hanging", async () => {
    h.auth = jardinero;
    renderWithProviders(<TrabajosExtras />);
    await waitFor(() => expect(screen.getByText("No hay trabajos extras registrados.")).toBeInTheDocument());
    expect(screen.queryByTestId("query-error")).not.toBeInTheDocument();
  });

  it("Jardinero · TrabajosExtras shows error UI when the query fails", async () => {
    h.auth = jardinero;
    h.mode = "error";
    renderWithProviders(<TrabajosExtras />);
    await waitFor(() => expect(screen.getByTestId("query-error")).toBeInTheDocument());
  });

  it("Encargado · ResumenEncargado loads without hanging", async () => {
    h.auth = encargado;
    renderWithProviders(<ResumenEncargado />);
    await waitFor(() => expect(screen.getByText("No hay registros pendientes.")).toBeInTheDocument());
    expect(screen.queryByTestId("query-error")).not.toBeInTheDocument();
  });

  it("Encargado · ResumenEncargado shows error UI when the query fails", async () => {
    h.auth = encargado;
    h.mode = "error";
    renderWithProviders(<ResumenEncargado />);
    await waitFor(() => expect(screen.getByTestId("query-error")).toBeInTheDocument());
  });

  it("Admin · Dashboard loads without hanging", async () => {
    h.auth = admin;
    renderWithProviders(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Resumen por jardín")).toBeInTheDocument());
    expect(screen.queryByTestId("query-error")).not.toBeInTheDocument();
  });

  it("Admin · Dashboard shows error UI when the query fails", async () => {
    h.auth = admin;
    h.mode = "error";
    renderWithProviders(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("query-error")).toBeInTheDocument());
  });

  it("Admin · GestionTrabajadores loads without hanging", async () => {
    h.auth = admin;
    renderWithProviders(<GestionTrabajadores />);
    await waitFor(() => expect(screen.getByText("Trabajadores")).toBeInTheDocument());
    expect(screen.queryByTestId("query-error")).not.toBeInTheDocument();
  });

  it("Admin · GestionTrabajadores shows error UI when the query fails", async () => {
    h.auth = admin;
    h.mode = "error";
    renderWithProviders(<GestionTrabajadores />);
    await waitFor(() => expect(screen.getByTestId("query-error")).toBeInTheDocument());
  });
});

// Every migrated page must resolve to the error UI on failure — never a
// permanent spinner. One assertion per page guards against regressions.
describe("all migrated pages recover from a failed load", () => {
  beforeEach(() => { h.mode = "error"; });

  const cases: Array<[string, () => JSX.Element, Record<string, unknown>]> = [
    ["GestionJardines", () => <GestionJardines />, admin],
    ["Tareas", () => <Tareas />, admin],
    ["ControlHorario", () => <ControlHorario />, admin],
    ["Presupuestos", () => <Presupuestos />, admin],
    ["HistorialJardinero", () => <HistorialJardinero />, jardinero],
    ["IncidenciasJardinero", () => <IncidenciasJardinero />, jardinero],
  ];

  for (const [name, Comp, auth] of cases) {
    it(`${name} shows error UI (not a spinner) when the query fails`, async () => {
      h.auth = auth;
      renderWithProviders(<Comp />);
      await waitFor(() => expect(screen.getByTestId("query-error")).toBeInTheDocument());
    });
  }
});
