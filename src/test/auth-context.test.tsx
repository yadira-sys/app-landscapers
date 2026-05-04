// Unit test for AuthContext using a mocked Supabase client. Runs without
// any credentials. Verifies that fetchRoleAndProfile populates state and
// that signOut clears it.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

type AuthCb = (event: string, session: unknown) => void;

// vi.hoisted ensures these are available when the vi.mock factory runs
// (factories are hoisted to the top of the file).
const mocks = vi.hoisted(() => {
  const session = {
    user: { id: "user-jard-1", email: "jard@test.local" },
    access_token: "tok",
    refresh_token: "rtok",
  };
  return {
    session,
    authCb: { current: (() => {}) as (e: string, s: unknown) => void },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: mocks.session } }),
      onAuthStateChange: vi.fn((cb: AuthCb) => {
        mocks.authCb.current = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data:
                table === "user_roles"
                  ? { role: "jardinero" }
                  : { id: "user-jard-1", full_name: "Felix Test", email: "jard@test.local" },
              error: null,
            }),
        }),
      }),
    })),
  },
}));

function Probe() {
  const { user, role, profile, loading, isJardinero, isAdmin } = useAuth();
  if (loading) return <div data-testid="state">loading</div>;
  return (
    <div>
      <div data-testid="state">ready</div>
      <div data-testid="user">{user?.email ?? "none"}</div>
      <div data-testid="role">{role ?? "none"}</div>
      <div data-testid="profile">{profile?.full_name ?? "none"}</div>
      <div data-testid="is-jardinero">{String(isJardinero)}</div>
      <div data-testid="is-admin">{String(isAdmin)}</div>
    </div>
  );
}

describe("AuthContext", () => {
  it("populates user, role, and profile from initial session", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready"));
    expect(screen.getByTestId("user").textContent).toBe("jard@test.local");
    expect(screen.getByTestId("role").textContent).toBe("jardinero");
    expect(screen.getByTestId("profile").textContent).toBe("Felix Test");
    expect(screen.getByTestId("is-jardinero").textContent).toBe("true");
    expect(screen.getByTestId("is-admin").textContent).toBe("false");
  });

  it("clears role and profile on SIGNED_OUT event", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready"));

    await act(async () => {
      mocks.authCb.current("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("none");
      expect(screen.getByTestId("role").textContent).toBe("none");
      expect(screen.getByTestId("profile").textContent).toBe("none");
    });
  });
});
