import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, LogOut, Loader2, Bell } from "lucide-react";
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

interface Asignacion {
  jardin_id: string;
  jardinero_id: string;
  jardinero_nombre: string;
}

function useNotificaciones(hasJornada: boolean, isWorker: boolean) {
  const [permiso, setPermiso] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!("Notification" in window)) { setPermiso("unsupported"); return; }
    setPermiso(Notification.permission);
  }, []);

  useEffect(() => {
    if (!isWorker || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (hasJornada) return;

    const hora = new Date().getHours();
    if (hora < 7 || hora > 11) return;

    const hoy = new Date().toISOString().split("T")[0];
    const clave = `notif_fichaje_${hoy}`;
    if (localStorage.getItem(clave)) return;

    localStorage.setItem(clave, "1");
    new Notification("Vitalia Garden", {
      body: "¡No olvides fichar tu entrada de hoy!",
      icon: "/pwa-192x192.png",
    });
  }, [hasJornada, isWorker]);

  const solicitar = async () => {
    if (!("Notification" in window)) return;
    const resultado = await Notification.requestPermission();
    setPermiso(resultado);
  };

  return { permiso, solicitar };
}

export default function MisJardines() {
  const { user, isEncargado, isAdmin } = useAuth();
  const { toast } = useToast();
  const [jardines, setJardines] = useState<Jardin[]>([]);
  const [jornadasActivas, setJornadasActivas] = useState<JornadaActiva[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const esVisionGlobal = isAdmin || isEncargado;
  const miJornadaActiva = jornadasActivas.find(j => j.jardinero_id === user?.id);
  const { permiso, solicitar } = useNotificaciones(!esVisionGlobal && !!miJornadaActiva, !esVisionGlobal);

  const fetchData = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      let jards: Jardin[] = [];
      if (esVisionGlobal) {
        let q = supabase.from("jardines").select("id, nombre, direccion").eq("activo", true);
        if (!isAdmin) q = q.eq("admin_only", false);
        const { data } = await q.order("nombre");
        jards = (data ?? []) as Jardin[];
      } else {
        const { data } = await supabase
          .from("asignaciones")
          .select("jardin_id, jardines(id, nombre, direccion)")
          .eq("jardinero_id", user.id)
          .eq("activo", true);
        jards = ((data ?? []) as any[]).map(a => a.jardines).filter(Boolean) as Jardin[];
      }
      setJardines(jards);

      if (esVisionGlobal) {
        const { data: jornadas } = await supabase
          .from("jornadas")
          .select("id, jardin_id, entrada_at, jardinero_id")
          .is("salida_at", null);
        const jornadasData = (jornadas ?? []) as JornadaActiva[];
        const ids = [...new Set(jornadasData.map(j => j.jardinero_id))];
        if (ids.length > 0) {
          const { data: perfiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
          const map = new Map((perfiles ?? []).map((p: any) => [p.id, p]));
          jornadasData.forEach(j => { (j as any).profiles = map.get(j.jardinero_id) ?? null; });
        }
        setJornadasActivas(jornadasData);

        const { data: asigData } = await supabase
          .from("asignaciones")
          .select("jardin_id, jardinero_id, profiles!asignaciones_jardinero_id_profiles_fkey(full_name)")
          .eq("activo", true);
        setAsignaciones(
          ((asigData ?? []) as any[]).map(a => ({
            jardin_id: a.jardin_id,
            jardinero_id: a.jardinero_id,
            jardinero_nombre: a.profiles?.full_name ?? "—",
          }))
        );
      } else {
        const { data } = await supabase
          .from("jornadas")
          .select("id, jardin_id, entrada_at, jardinero_id")
          .eq("jardinero_id", user.id)
          .is("salida_at", null);
        setJornadasActivas((data ?? []) as JornadaActiva[]);
      }
    } catch (e) {
      console.error("MisJardines error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user?.id, isEncargado, isAdmin]);

  const jornadasDeJardin = (jardinId: string) => jornadasActivas.filter(j => j.jardin_id === jardinId);
  const miJornada = (jardinId: string) => jornadasActivas.find(j => j.jardin_id === jardinId && j.jardinero_id === user?.id);
  const asignacionDeJardin = (jardinId: string) => asignaciones.find(a => a.jardin_id === jardinId) ?? null;

  const handleCheckIn = async (jardinId: string) => {
    if (!user) return;
    setActionLoading(jardinId);
    const { error } = await supabase.from("jornadas").insert({ jardinero_id: user.id, jardin_id: jardinId });
    if (error) toast({ title: "Error al registrar entrada", variant: "destructive" });
    else { toast({ title: "✅ Entrada registrada" }); await fetchData(); }
    setActionLoading(null);
  };

  const handleCheckOut = async (jornadaId: string) => {
    setActionLoading(jornadaId);
    const jornada = jornadasActivas.find(j => j.id === jornadaId);
    const now = new Date();
    let duracion: number | null = null;
    let totalHoras: number | null = null;
    if (jornada) {
      const entrada = new Date(jornada.entrada_at);
      duracion = Math.round((now.getTime() - entrada.getTime()) / 60000);
      totalHoras = Math.round(duracion / 60 * 100) / 100;
    }
    const { error } = await supabase.from("jornadas").update({
      salida_at: now.toISOString(),
      duracion_minutos: duracion,
      total_horas: totalHoras,
      fecha: now.toISOString().split("T")[0],
      hora_inicio: jornada ? format(new Date(jornada.entrada_at), "HH:mm") : null,
      hora_fin: format(now, "HH:mm"),
      estado: "pendiente" as any,
    }).eq("id", jornadaId);
    if (error) toast({ title: "Error al registrar salida", variant: "destructive" });
    else { toast({ title: "✅ Salida registrada" }); await fetchData(); }
    setActionLoading(null);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(155 45% 45%)" }} />
    </div>
  );

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-light tracking-wide">
            {isAdmin ? "Actividad de Jardines" : "Mis Jardines"}
          </h1>
          <div className="h-px w-12 mt-2" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
        </div>
        {/* Notificaciones: solo jardineros */}
        {!esVisionGlobal && permiso !== "unsupported" && permiso !== "granted" && (
          <button
            onClick={solicitar}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-sm border transition-all"
            style={{ borderColor: "hsl(38 90% 60%)", color: "hsl(38 90% 38%)", backgroundColor: "hsl(38 90% 50% / 0.08)" }}
          >
            <Bell className="h-3.5 w-3.5" /> Activar avisos
          </button>
        )}
        {!esVisionGlobal && permiso === "granted" && (
          <div className="flex items-center gap-1 text-xs" style={{ color: "hsl(155 45% 40%)" }}>
            <Bell className="h-3.5 w-3.5" />
            <span>Avisos activos</span>
          </div>
        )}
      </div>

      {jardines.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No hay jardines asignados todavía.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jardines.map(jardin => {
            const jornadas = jornadasDeJardin(jardin.id);
            const miJorn = miJornada(jardin.id);
            const asignacion = asignacionDeJardin(jardin.id);
            const hayActividad = jornadas.length > 0;

            return (
              <div
                key={jardin.id}
                className="rounded-sm border p-4"
                style={{
                  backgroundColor: "hsl(0 0% 100%)",
                  borderColor: hayActividad ? "hsl(155 40% 70%)" : "hsl(30 10% 90%)",
                  borderLeftWidth: hayActividad ? "3px" : "1px",
                  borderLeftColor: hayActividad ? "hsl(155 40% 40%)" : undefined,
                }}
              >
                {/* Header jardín */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{jardin.nombre}</p>
                    {jardin.direccion && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{jardin.direccion}</p>
                    )}
                  </div>

                  {/* Botones check-in/out: solo para jardineros y encargado operativo */}
                  {!isAdmin && (
                    <div className="shrink-0">
                      {miJorn ? (
                        <button
                          disabled={actionLoading === miJorn.id}
                          onClick={() => handleCheckOut(miJorn.id)}
                          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium tracking-wide uppercase rounded-sm transition-all disabled:opacity-50"
                          style={{
                            backgroundColor: "hsl(0 72% 51% / 0.1)",
                            color: "hsl(0 72% 45%)",
                            border: "1px solid hsl(0 72% 51% / 0.3)",
                          }}
                        >
                          {actionLoading === miJorn.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <LogOut className="h-4 w-4" />
                          }
                          Salida
                        </button>
                      ) : (
                        <button
                          disabled={actionLoading === jardin.id}
                          onClick={() => handleCheckIn(jardin.id)}
                          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium tracking-wide uppercase rounded-sm transition-all disabled:opacity-50"
                          style={{
                            backgroundColor: "hsl(155 40% 20%)",
                            color: "hsl(0 0% 98%)",
                            border: "1px solid hsl(155 40% 30%)",
                          }}
                        >
                          {actionLoading === jardin.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <LogIn className="h-4 w-4" />
                          }
                          Entrada
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Estado jornada propia (jardinero) */}
                {!esVisionGlobal && miJorn && (
                  <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid hsl(30 10% 93%)" }}>
                    <div className="h-2 w-2 rounded-full animate-pulse shrink-0" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
                    <span className="text-xs" style={{ color: "hsl(155 40% 38%)" }}>
                      En jornada desde {format(new Date(miJorn.entrada_at), "HH:mm")}
                    </span>
                  </div>
                )}

                {/* Vista supervisor */}
                {esVisionGlobal && (
                  <div className="mt-3 pt-3 space-y-2" style={{ borderTop: "1px solid hsl(30 10% 93%)" }}>
                    {asignacion ? (
                      <p className="text-xs" style={{ color: "hsl(30 5% 48%)" }}>
                        Asignado: <span style={{ color: "hsl(30 5% 30%)" }}>{asignacion.jardinero_nombre}</span>
                      </p>
                    ) : (
                      <p className="text-xs italic" style={{ color: "hsl(30 5% 60%)" }}>Sin jardinero asignado</p>
                    )}

                    {jornadas.map(j => (
                      <div key={j.id} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
                        <span className="text-xs flex-1" style={{ color: "hsl(155 40% 38%)" }}>
                          {(j as any).profiles?.full_name ?? "Jardinero"} · desde {format(new Date(j.entrada_at), "HH:mm")}
                        </span>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => handleCheckOut(j.id)}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase rounded-sm transition-all disabled:opacity-50"
                          style={{
                            backgroundColor: "hsl(0 72% 51% / 0.1)",
                            color: "hsl(0 72% 45%)",
                            border: "1px solid hsl(0 72% 51% / 0.3)",
                          }}
                        >
                          <LogOut className="h-3 w-3" /> Salida
                        </button>
                      </div>
                    ))}

                    {!hayActividad && (
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(30 5% 60%)" }}>
                        Sin actividad hoy
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
