import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Loader2, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { exportCsv } from "@/lib/exportCsv";

interface Jornada {
  id: string;
  jardinero_id: string;
  jardin_id: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  total_horas: number | null;
  descripcion: string | null;
  estado: "pendiente" | "aprobado" | "rechazado";
  jardines: { nombre: string } | null;
  profiles: { full_name: string } | null;
}

const estadoColors: Record<string, { color: string; bg: string }> = {
  pendiente: { color: "hsl(38 90% 50%)",  bg: "hsl(38 90% 50% / 0.12)" },
  aprobado:  { color: "hsl(155 45% 40%)", bg: "hsl(155 45% 40% / 0.12)" },
  rechazado: { color: "hsl(0 72% 51%)",   bg: "hsl(0 72% 51% / 0.12)" },
};

export default function ControlHorario() {
  const { isAdmin } = useAuth();
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [trabajadores, setTrabajadores] = useState<{ id: string; full_name: string }[]>([]);
  const [jardines, setJardines] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [fechaDesde, setFechaDesde] = useState(startOfMonth(new Date()).toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(endOfMonth(new Date()).toISOString().split("T")[0]);
  const [filtroTrabajador, setFiltroTrabajador] = useState("todos");
  const [filtroJardin, setFiltroJardin] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const setPreset = (preset: "semana" | "mes" | "anterior") => {
    if (preset === "semana") {
      setFechaDesde(startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split("T")[0]);
      setFechaHasta(endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split("T")[0]);
    } else if (preset === "mes") {
      setFechaDesde(startOfMonth(new Date()).toISOString().split("T")[0]);
      setFechaHasta(endOfMonth(new Date()).toISOString().split("T")[0]);
    } else {
      const prev = subMonths(new Date(), 1);
      setFechaDesde(startOfMonth(prev).toISOString().split("T")[0]);
      setFechaHasta(endOfMonth(prev).toISOString().split("T")[0]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    let q = supabase
      .from("jornadas")
      .select("id, jardinero_id, jardin_id, fecha, hora_inicio, hora_fin, total_horas, descripcion, estado, jardines(nombre), profiles!jornadas_jardinero_id_profiles_fkey(full_name)")
      .gte("fecha", fechaDesde)
      .lte("fecha", fechaHasta)
      .not("hora_fin", "is", null)
      .order("fecha", { ascending: false });

    if (filtroTrabajador !== "todos") q = q.eq("jardinero_id", filtroTrabajador);
    if (filtroJardin !== "todos") q = q.eq("jardin_id", filtroJardin);
    if (filtroEstado !== "todos") q = q.eq("estado", filtroEstado as any);

    const [jornadasRes, trabajadoresRes, jardinesRes] = await Promise.all([
      q.limit(500),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      (() => { let jq = supabase.from("jardines").select("id, nombre").eq("activo", true); if (!isAdmin) jq = jq.eq("admin_only", false); return jq.order("nombre"); })(),
    ]);

    if (jornadasRes.data) setJornadas(jornadasRes.data as unknown as Jornada[]);
    if (trabajadoresRes.data) setTrabajadores(trabajadoresRes.data);
    if (jardinesRes.data) setJardines(jardinesRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [fechaDesde, fechaHasta, filtroTrabajador, filtroJardin, filtroEstado, isAdmin]);

  // Summary by worker
  const resumenPorTrabajador = trabajadores
    .map(t => ({
      ...t,
      totalHoras: jornadas.filter(j => j.jardinero_id === t.id).reduce((s, j) => s + (j.total_horas ?? 0), 0),
      count: jornadas.filter(j => j.jardinero_id === t.id).length,
    }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.totalHoras - a.totalHoras);

  const totalHorasGlobal = jornadas.reduce((s, j) => s + (j.total_horas ?? 0), 0);

  // Group by date
  const jornadasPorFecha = jornadas.reduce((acc, j) => {
    (acc[j.fecha] = acc[j.fecha] ?? []).push(j);
    return acc;
  }, {} as Record<string, Jornada[]>);

  return (
    <div className="p-5 space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-light tracking-wide">Control Horario</h1>
        <div className="h-px w-12 mt-2" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: "Esta semana", action: () => setPreset("semana") },
            { label: "Este mes", action: () => setPreset("mes") },
            { label: "Mes anterior", action: () => setPreset("anterior") },
          ].map(p => (
            <button
              key={p.label}
              onClick={p.action}
              className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider rounded-sm border transition-all"
              style={{ borderColor: "hsl(30 10% 82%)", color: "hsl(30 5% 45%)", backgroundColor: "hsl(0 0% 99%)" }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={filtroTrabajador} onValueChange={setFiltroTrabajador}>
            <SelectTrigger className="h-9 text-xs border-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los trabajadores</SelectItem>
              {trabajadores.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroJardin} onValueChange={setFiltroJardin}>
            <SelectTrigger className="h-9 text-xs border-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los jardines</SelectItem>
              {jardines.map(j => <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="h-9 text-xs border-input w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="aprobado">Aprobado</SelectItem>
            <SelectItem value="rechazado">Rechazado</SelectItem>
          </SelectContent>
        </Select>
        {jornadas.length > 0 && (
          <button
            onClick={() => {
              const headers = ["Fecha", "Trabajador", "Jardín", "Inicio", "Fin", "Horas", "Descripción", "Estado"];
              const rows = jornadas.map(j => [
                j.fecha, j.profiles?.full_name ?? "", j.jardines?.nombre ?? "",
                j.hora_inicio ?? "", j.hora_fin ?? "", j.total_horas?.toString() ?? "",
                j.descripcion ?? "", j.estado,
              ]);
              exportCsv(`control_horario_${fechaDesde}_${fechaHasta}.csv`, headers, rows);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs"
            style={{ borderColor: "hsl(30 10% 80%)", color: "hsl(30 5% 40%)" }}
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(155 45% 45%)" }} />
        </div>
      ) : (
        <>
          {/* Resumen por trabajador */}
          {resumenPorTrabajador.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>
                Resumen del periodo
              </p>
              <div className="rounded-sm border overflow-hidden" style={{ borderColor: "hsl(30 10% 90%)" }}>
                {resumenPorTrabajador.map((t, i) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-3 py-2.5"
                    style={{
                      borderBottom: i < resumenPorTrabajador.length - 1 ? "1px solid hsl(30 10% 93%)" : "none",
                      backgroundColor: "hsl(0 0% 100%)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ backgroundColor: "hsl(155 40% 35%)" }}
                      >
                        {t.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm">{t.full_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: "hsl(30 5% 55%)" }}>{t.count} jornadas</span>
                      <span className="text-sm font-semibold" style={{ color: "hsl(155 45% 30%)" }}>
                        {t.totalHoras.toFixed(1)}h
                      </span>
                    </div>
                  </div>
                ))}
                <div
                  className="flex items-center justify-between px-3 py-2.5"
                  style={{ backgroundColor: "hsl(155 45% 40% / 0.06)", borderTop: "1px solid hsl(155 45% 40% / 0.2)" }}
                >
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "hsl(155 40% 38%)" }}>
                    Total periodo
                  </span>
                  <span className="text-sm font-bold" style={{ color: "hsl(155 45% 28%)" }}>
                    {totalHorasGlobal.toFixed(1)}h
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Jornadas por fecha */}
          {Object.keys(jornadasPorFecha).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No hay registros en este periodo.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(jornadasPorFecha).map(([fecha, jorns]) => {
                const totalDia = jorns.reduce((s, j) => s + (j.total_horas ?? 0), 0);
                return (
                  <div key={fecha} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p
                        className="text-xs font-medium uppercase tracking-wider"
                        style={{ color: "hsl(30 5% 42%)" }}
                      >
                        {format(new Date(fecha + "T00:00:00"), "EEEE d MMMM", { locale: es })}
                      </p>
                      <span className="text-xs font-semibold" style={{ color: "hsl(155 45% 35%)" }}>
                        {totalDia.toFixed(1)}h
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {jorns.map(j => {
                        const ec = estadoColors[j.estado] ?? estadoColors.pendiente;
                        return (
                          <div
                            key={j.id}
                            className="rounded-sm border px-3 py-2.5 flex items-center gap-3"
                            style={{ backgroundColor: "hsl(0 0% 100%)", borderColor: "hsl(30 10% 92%)" }}
                          >
                            <div
                              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                              style={{ backgroundColor: "hsl(155 40% 35%)" }}
                            >
                              {(j.profiles?.full_name ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{j.profiles?.full_name ?? "—"}</p>
                              <p className="text-xs truncate" style={{ color: "hsl(30 5% 55%)" }}>
                                {j.jardines?.nombre ?? "—"}
                              </p>
                              {j.descripcion && (
                                <p className="text-xs truncate mt-0.5" style={{ color: "hsl(30 5% 60%)" }}>
                                  {j.descripcion}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs" style={{ color: "hsl(30 5% 42%)" }}>
                                {j.hora_inicio?.slice(0, 5)} – {j.hora_fin?.slice(0, 5)}
                              </p>
                              <p className="text-xs font-semibold" style={{ color: "hsl(155 45% 30%)" }}>
                                {j.total_horas?.toFixed(1) ?? "—"}h
                              </p>
                            </div>
                            <span
                              className="text-[9px] font-medium uppercase px-1.5 py-0.5 rounded-sm shrink-0"
                              style={{ backgroundColor: ec.bg, color: ec.color }}
                            >
                              {j.estado}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
