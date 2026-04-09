import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TreePine, LogIn, LogOut, Loader2, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Jardin {
  id: string;
  nombre: string;
  direccion: string | null;
}

interface JornadaActiva {
  id: string;
  jardin_id: string;
  entrada_at: string;
  jardinero_id: string;
  profiles?: { full_name: string } | null;
}

/** Ensure we have a valid session, refreshing if needed. Timeout after 8s. */
async function ensureSession(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { clearTimeout(timeout); return false; }
    const expiresAt = session.expires_at ?? 0;
    if (expiresAt * 1000 - Date.now() < 60000) {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("Session refresh failed:", error.message);
        clearTimeout(timeout);
        return false;
      }
    }
    clearTimeout(timeout);
    return true;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

export default function Fichaje() {
  const { user, profile, isEncargado, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const esSupervisor = isAdmin || isEncargado;
  const [jardines, setJardines] = useState<Jardin[]>([]);
  const [jornadasActivas, setJornadasActivas] = useState<JornadaActiva[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleSessionExpired = useCallback(() => {
    toast({
      title: "Sesión expirada",
      description: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
      variant: "destructive",
    });
    signOut();
  }, [toast, signOut]);

  const fetchData = useCallback(async (showLoader = true) => {
    if (!user) { setLoading(false); return; }
    if (showLoader) setLoading(true);
    try {
      // Refresh session before fetching
      const valid = await ensureSession();
      if (!valid) { handleSessionExpired(); return; }

      // All workers see all active gardens (admin_only filtered for non-admins)
      let q = supabase.from("jardines").select("id, nombre, direccion").eq("activo", true);
      if (!isAdmin) q = q.eq("admin_only", false);
      const { data: jards, error: jardsError } = await q.order("nombre");
      if (jardsError) {
        console.error("Fetch jardines error:", jardsError);
        if (jardsError.message?.includes("JWT")) { handleSessionExpired(); return; }
      }
      setJardines((jards ?? []) as Jardin[]);

      // Active sessions
      if (esSupervisor) {
        const { data: jornadas, error: jErr } = await supabase
          .from("jornadas")
          .select("id, jardin_id, entrada_at, jardinero_id")
          .is("salida_at", null);
        if (jErr) {
          console.error("Fetch jornadas error:", jErr);
          if (jErr.message?.includes("JWT")) { handleSessionExpired(); return; }
        }
        const jornadasData = (jornadas ?? []) as JornadaActiva[];
        const jardineroIds = [...new Set(jornadasData.map(j => j.jardinero_id))];
        if (jardineroIds.length > 0) {
          const { data: perfiles } = await supabase.from("profiles").select("id, full_name").in("id", jardineroIds);
          const map = new Map((perfiles ?? []).map((p: any) => [p.id, p]));
          jornadasData.forEach(j => { (j as any).profiles = map.get(j.jardinero_id) ?? null; });
        }
        setJornadasActivas(jornadasData);
      } else {
        const { data, error: jErr } = await supabase
          .from("jornadas")
          .select("id, jardin_id, entrada_at, jardinero_id")
          .eq("jardinero_id", user.id)
          .is("salida_at", null);
        if (jErr) {
          console.error("Fetch jornadas error:", jErr);
          if (jErr.message?.includes("JWT")) { handleSessionExpired(); return; }
        }
        setJornadasActivas((data ?? []) as JornadaActiva[]);
      }
    } catch (e) {
      console.error("Fichaje fetchData error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isEncargado, esSupervisor, handleSessionExpired]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh data every 5 minutes to keep session alive and data fresh
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => fetchData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, fetchData]);

  // Refresh on visibility change (when user comes back to the tab/app)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchData(false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchData]);

  const miJornada = (jardinId: string) =>
    jornadasActivas.find(j => j.jardin_id === jardinId && j.jardinero_id === user?.id);

  const jornadasDeJardin = (jardinId: string) =>
    jornadasActivas.filter(j => j.jardin_id === jardinId);

  const handleCheckIn = async (jardinId: string) => {
    if (!user) return;
    setActionLoading(jardinId);
    try {
      const valid = await ensureSession();
      if (!valid) { handleSessionExpired(); setActionLoading(null); return; }

      const { error } = await supabase.from("jornadas").insert({
        jardinero_id: user.id,
        jardin_id: jardinId,
        entrada_at: new Date().toISOString(),
        fecha: new Date().toISOString().split("T")[0],
      });
      if (error) {
        console.error("Check-in error:", error);
        if (error.message?.includes("JWT")) { handleSessionExpired(); return; }
        toast({ title: "Error al fichar entrada", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Entrada fichada" });
        await fetchData();
      }
    } catch (e) {
      console.error("Check-in unexpected error:", e);
      toast({ title: "Error inesperado", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckOut = async (jornadaId: string) => {
    setActionLoading(jornadaId);
    try {
      const valid = await ensureSession();
      if (!valid) { handleSessionExpired(); setActionLoading(null); return; }

      const now = new Date();
      const jornada = jornadasActivas.find(j => j.id === jornadaId);
      let totalHoras: number | null = null;
      if (jornada) {
        const entrada = new Date(jornada.entrada_at);
        const duracion = Math.round((now.getTime() - entrada.getTime()) / 60000);
        totalHoras = Math.round(duracion / 60 * 100) / 100;
      }

      // NOTE: duracion_minutos is a GENERATED ALWAYS column — do NOT include it
      const { error, data } = await supabase
        .from("jornadas")
        .update({
          salida_at: now.toISOString(),
          total_horas: totalHoras,
          fecha: now.toISOString().split("T")[0],
          hora_inicio: jornada ? format(new Date(jornada.entrada_at), "HH:mm") : null,
          hora_fin: format(now, "HH:mm"),
          estado: "pendiente" as any,
        })
        .eq("id", jornadaId)
        .select();

      if (error) {
        console.error("Check-out error:", JSON.stringify(error));
        if (error.message?.includes("JWT")) { handleSessionExpired(); return; }
        toast({ title: "Error al fichar salida", description: error.message, variant: "destructive" });
      } else if (!data || data.length === 0) {
        console.error("Check-out: 0 rows updated");
        toast({
          title: "Error al fichar salida",
          description: "No se pudo actualizar. Pulsa el botón de actualizar e intenta de nuevo.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Salida fichada" });
        await fetchData();
      }
    } catch (e) {
      console.error("Check-out unexpected error:", e);
      toast({ title: "Error inesperado", description: "Pulsa actualizar e intenta de nuevo.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // Compute total active hours for admin view
  const totalActivas = jornadasActivas.length;
  const horasActivas = jornadasActivas.reduce((sum, j) => {
    const mins = (Date.now() - new Date(j.entrada_at).getTime()) / 60000;
    return sum + mins;
  }, 0);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(155 45% 45%)" }} />
    </div>
  );

  return (
    <div className="p-5 space-y-5">
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-light tracking-wide">Fichaje</h1>
          <div className="h-px w-12 mt-2" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
        </div>
        <button
          onClick={() => fetchData()}
          className="p-2 rounded-sm transition-all active:scale-95"
          style={{ color: "hsl(155 45% 45%)" }}
          title="Actualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Admin summary */}
      {esSupervisor && totalActivas > 0 && (
        <div className="rounded-sm border p-3 flex items-center gap-3" style={{ backgroundColor: "hsl(155 45% 40% / 0.08)", borderColor: "hsl(155 40% 70%)" }}>
          <Clock className="h-5 w-5 shrink-0" style={{ color: "hsl(155 45% 40%)" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "hsl(155 45% 25%)" }}>
              {totalActivas} fichaje{totalActivas > 1 ? "s" : ""} activo{totalActivas > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              ~{Math.round(horasActivas / 60 * 10) / 10}h en curso
            </p>
          </div>
        </div>
      )}

      {jardines.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TreePine className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay jardines activos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jardines.map(jardin => {
            const jornadas = jornadasDeJardin(jardin.id);
            const miJorn = miJornada(jardin.id);
            const hayActividad = jornadas.length > 0;

            return (
              <div
                key={jardin.id}
                className="rounded-sm border p-4"
                style={{
                  backgroundColor: "hsl(0 0% 100%)",
                  borderColor: hayActividad ? "hsl(155 40% 70%)" : "hsl(30 10% 90%)",
                  borderLeftWidth: hayActividad ? "3px" : "1px",
                  borderLeftColor: hayActividad ? "hsl(155 40% 40%)" : "hsl(30 10% 90%)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{jardin.nombre}</p>
                    {jardin.direccion && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{jardin.direccion}</p>
                    )}

                    {/* Supervisor: show all active sessions */}
                    {esSupervisor && jornadas.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {jornadas.map(j => (
                          <div key={j.id} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
                            <span className="text-xs flex-1" style={{ color: "hsl(155 40% 38%)" }}>
                              {(j as any).profiles?.full_name ?? "Trabajador"} · desde {format(new Date(j.entrada_at), "HH:mm")}
                            </span>
                            {isAdmin && (
                              <button
                                disabled={!!actionLoading}
                                onClick={() => handleCheckOut(j.id)}
                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase rounded-sm transition-all disabled:opacity-50 flex-shrink-0"
                                style={{ backgroundColor: "hsl(0 72% 51% / 0.1)", color: "hsl(0 72% 45%)", border: "1px solid hsl(0 72% 51% / 0.3)" }}
                              >
                                <LogOut className="h-3 w-3" /> Salida
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Worker: own session info */}
                    {!esSupervisor && miJorn && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
                        <span className="text-xs" style={{ color: "hsl(155 40% 38%)" }}>
                          Fichado desde {format(new Date(miJorn.entrada_at), "HH:mm")}
                        </span>
                      </div>
                    )}

                    {/* No activity */}
                    {!hayActividad && esSupervisor && (
                      <p className="text-[10px] uppercase tracking-wider mt-2" style={{ color: "hsl(30 5% 60%)" }}>Sin actividad</p>
                    )}
                  </div>

                  {/* Check-in/out buttons for workers and encargado */}
                  <div className="shrink-0">
                    {miJorn ? (
                      <button
                        disabled={actionLoading === miJorn.id}
                        onClick={() => handleCheckOut(miJorn.id)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium tracking-wide uppercase transition-all disabled:opacity-50 rounded-sm"
                        style={{ backgroundColor: "hsl(0 72% 51% / 0.1)", color: "hsl(0 72% 45%)", border: "1px solid hsl(0 72% 51% / 0.3)" }}
                      >
                        {actionLoading === miJorn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                        Salida
                      </button>
                    ) : (
                      <button
                        disabled={actionLoading === jardin.id}
                        onClick={() => handleCheckIn(jardin.id)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium tracking-wide uppercase transition-all disabled:opacity-50 rounded-sm"
                        style={{ backgroundColor: "hsl(155 40% 20%)", color: "hsl(0 0% 98%)", border: "1px solid hsl(155 40% 30%)" }}
                      >
                        {actionLoading === jardin.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                        Entrada
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
