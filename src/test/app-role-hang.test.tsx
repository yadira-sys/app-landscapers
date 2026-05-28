// Regression test for the app-wide "se queda pillada" bug: a logged-in user
// whose role resolves to null (failed role fetch OR no user_roles row) used to
// be trapped on a full-screen spinner forever. Now AppRoutes shows a RoleError
// escape screen with "Reintentar" / "Cerrar sesión".
//
// Uses the REAL AuthContext (not mocked) so the AuthProvider -> AppRoutes wiring
// is exercised end to end; only the Supabase client is mocked.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const session = { user: { id: "u-1", email: "x@test.local" }, access_token: "t", refresh_token: "r" };

vi.mock("@/integrations/supabase/client", () => {
  // user_roles returns no row -> role stays null (the bug trigger).
  const tableResult = (table: string) =>
    table === "user_roles"
      ? { data: null, error: null }
      : { data: { id: "u-1", full_name: "Test", email: "x@test.local" }, error: null };

  const makeChain = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit", "not", "gte", "lte", "is", "in", "single"]) chain[m] = () => chain;
    chain.maybeSingle = () => Promise.resolve(tableResult(table));
    chain.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(tableResult(table)).then(onF, onR);
    return chain;
  };

  return {
    supabase: {
      from: (t: string) => makeChain(t),
      auth: {
        getSession: () => Promise.resolve({ data: { session } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: () => Promise.resolve({ error: null }),
        signInWithPassword: () => Promise.resolve({ error: null }),
      },
    },
  };
});

import App from "@/App";

describe("app-level role resolution", () => {
  it("shows an escape screen (not an infinite spinner) when the role is null", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId("role-error")).toBeInTheDocument());
    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument();
    expect(screen.getByText("Reintentar")).toBeInTheDocument();
  });
});
