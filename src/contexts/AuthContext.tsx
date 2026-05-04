import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "dueno" | "admin" | "encargado" | "jardinero";

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isEncargado: boolean;
  isJardinero: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoleAndProfile = async (userId: string, isMounted?: () => boolean) => {
    try {
      const [roleRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      ]);
      if (isMounted && !isMounted()) return;
      if (roleRes.data) setRole(roleRes.data.role as AppRole);
      if (profileRes.data) setProfile(profileRes.data as Profile);
    } catch (e) {
      console.error("Error fetching role/profile:", e);
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const initialize = async (session: import("@supabase/supabase-js").Session | null) => {
      if (!mounted || initialized) return;
      initialized = true;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchRoleAndProfile(session.user.id, () => mounted);
      } else {
        setRole(null);
        setProfile(null);
      }

      if (mounted) setLoading(false);
    };

    // 1. Obtener sesion actual inmediatamente (garantia para produccion)
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialize(session);
    }).catch((err) => {
      // Lock acquisition timeout u otro error — proceder sin sesion
      console.error("getSession failed:", err);
      if (mounted) {
        setSession(null);
        setUser(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // 2. Escuchar cambios posteriores (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (!initialized) {
          // Si INITIAL_SESSION llega antes que getSession, usarlo
          initialize(session);
        } else {
          // Cambios posteriores (login / logout)
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchRoleAndProfile(session.user.id, () => mounted);
          } else {
            setRole(null);
            setProfile(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setRole(null);
    setProfile(null);
    await supabase.auth.signOut();
  };

  const isAdmin = role === "admin" || role === "dueno";
  const isEncargado = role === "encargado";
  const isJardinero = role === "jardinero";

  return (
    <AuthContext.Provider value={{
      user, session, role, profile, loading,
      signIn, signOut, isAdmin, isEncargado, isJardinero,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
