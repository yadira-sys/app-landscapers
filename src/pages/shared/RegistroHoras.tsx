import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, Loader2, X, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { exportCsv } from "@/lib/exportCsv";

type EstadoRegistro = "pendiente" | "aprobado" | "rechazado";

interface Registro {
  id: string;
  jardin_id: string;
  jardinero_id: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  total_horas: number | null;
  descripcion: string | null;
  estado: EstadoRegistro;
  created_at: string;
  jardines: { nombre: string } | null;
  profiles: { full_name: string } | null;
}

interface Jardin { id: string; nombre: string; }

const estadoConfig: Record<EstadoRegistro, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "hsl(38 90% 50%)", bg: "hsl(38 90% 50% / 0.12)" },
  aprobado:  { label: "Aprobado",  color: "hsl(155 45% 40%)", bg: "hsl(155 45% 40% / 0.12)" },
  rechazado: { label: "Rechazado", color: "hsl(0 72% 51%)",   bg: "hsl(0 72% 51% / 0.12)" },
};

export default function RegistroHoras() {
  const { user, isAdmin, isEncargado, profile } = useAuth();
  const { toast } = useToast();
  const esSupervisor = isAdmin || isEncargado;

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [jardines, setJardines] = useState<Jardin[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  // Form
  const [jardinId, setJardinId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // Filters
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroJardin, setFiltroJardin] = useState("todos");
  const [filtroTrabajador, setFiltroTrabajador] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState(startOfMonth(new Date()).toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(endOfMonth(new Date()).toISOString().split("T")[0]);
  const [trabajadores, setTrabajadores] = useState<{ id: string; full_name: string }[]>([]);

  const setPreset = (preset: "mes" | "anterior" | "todo") => {
    if (preset === "mes") {
      setFechaDesde(startOfMonth(new Date()).toISOString().split("T")[0]);
      setFechaHasta(endOfMonth(new Date()).toISOString().split("T")[0]);
    } else if (preset === "anterior") {
      const prev = subMonths(new Date(), 1);
      setFechaDesde(startOfMonth(prev).toISOString().split("T")[0]);
      setFechaHasta(endOfMonth(prev).toISOString().split("T")[0]);
    } else {
      setFechaDesde("2020-01-01");
      setFechaHasta("2099-12-31");
    }
  };

  const calcTotalHoras = (hi: string, hf: string): number | null => {
    if (!hi || !hf) return null;
    const [h1, m1] = hi.split(":").map(Number);
    const [h2, m2] = hf.split(":").map(Number);
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    return mins > 0 ? Math.round(mins / 60 * 100) / 100 : null;
  };

  const fetchData = async () => {
    const registrosQ = supabase
      .from("jornadas")
      .select("id, jardin_id, jardinero_id, fecha, hora_inicio, hora_fin, total_horas, descripcion, estado, created_at, jardines(nombre), profiles!jornadas_jardinero_id_profiles_fkey(full_name)")
      .not("hora_inicio", "is", null)
      .gte("fecha", fechaDesde)
      .lte("fecha", fechaHasta)
      .order("fecha", { ascending: false })
      .limit(300);

    const [jardinesRes, registrosRes, trabajadoresRes] = await Promise.all([
      (() => { let q = supabase.from("jardines").select("id, nombre").eq("activo", true); if (!isAdmin) q = q.eq("admin_only", false); return q.order("nombre"); })(),
      registrosQ,
      esSupervisor ? supabase.from("profiles").select("id, full_name").order("full_name") : Promise.resolve({ data: [] }),
    ]);
    if (jardinesRes.data) setJardines(jardinesRes.data);
    if (registrosRes.data) setRegistros(registrosRes.data as unknown as Registro[]);
    if (trabajadoresRes.data) setTrabajadores(trabajadoresRes.data as { id: string; full_name: string }[]);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [isAdmin, fechaDesde, fechaHasta]);

  const cancelForm = () => {
    setShowForm(false);
    setJardinId(""); setFecha(new Date().toISOString().split("T")[0]);
    setHoraInicio(""); setHoraFin(""); setDescripcion("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jardinId || !horaInicio || !horaFin) {
      toast({ title: "Rellena jardín, hora inicio y hora fin", variant: "destructive" });
      return;
    }
    const total = calcTotalHoras(horaInicio, horaFin);
    if (!total || total <= 0) {
      toast({ title: "La hora fin debe ser posterior a la hora inicio", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: insertedData, error } = await supabase.from("jornadas").insert({
      jardinero_id: user!.id,
      jardin_id: jardinId,
      fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      total_horas: total,
      descripcion: descripcion.trim() || null,
      estado: "pendiente",
      entrada_at: new Date().toISOString(),
    }).select("id").single();
    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Horas registradas (pendiente de aprobación)" });
      // No sync to Holded here — only approved hours get synced
      cancelForm();
      await fetchData();
    }
    setSubmitting(false);
  };

  const updateEstado = async (id: string, estado: EstadoRegistro) => {
    setUpdating(id);
    const registro = registros.find(r => r.id === id);
    const { error } = await supabase.from("jornadas").update({ estado }).eq("id", id);
    if (error) {
      toast({ title: "Error al actualizar", variant: "destructive" });
    } else {
        toast({ title: "✅ Estado actualizado" });
      await fetchData();
    }
    setUpdating(null);
  };

  const registrosFiltrados = registros
    .filter(r => filtroEstado === "todos" || r.estado === filtroEstado)
    .filter(r => filtroJardin === "todos" || r.jardin_id === filtroJardin)
    .filter(r => filtroTrabajador === "todos" || r.jardinero_id === filtroTrabajador);

  const totalPreview = calcTotalHoras(horaInicio, horaFin);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-light tracking-wide">Registro de Horas</h1>
          <p className="text-xs mt-1" style={{ color: "hsl(30 5% 55%)" }}>Registro flexible · añade horas pasadas</p>
          <div className="h-px w-12 mt-2" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
        </div>
        <button
          onClick={() => showForm ? cancelForm() : setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium tracking-wide uppercase rounded-sm transition-all"
          style={showForm
            ? { backgroundColor: "hsl(0 0% 90%)", color: "hsl(30 5% 30%)", border: "1px solid hsl(0 0% 80%)" }
            : { backgroundColor: "hsl(155 40% 20%)", color: "hsl(0 0% 98%)", border: "1px solid hsl(155 40% 30%)" }
          }
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancelar" : "Registrar"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-sm border p-4 space-y-4" style={{ borderColor: "hsl(155 40% 70%)", borderLeftWidth: "3px", borderLeftColor: "hsl(155 40% 40%)" }}>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "hsl(155 40% 38%)" }}>Nuevo registro</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Jardín *</label>
              <Select value={jardinId} onValueChange={setJardinId}>
                <SelectTrigger className="h-9 text-sm border-input"><SelectValue placeholder="Selecciona jardín..." /></SelectTrigger>
                <SelectContent>{jardines.map(j => <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Hora inicio *</label>
                <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Hora fin *</label>
                <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
            </div>

            {totalPreview && totalPreview > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ backgroundColor: "hsl(155 45% 40% / 0.1)" }}>
                <Clock className="h-4 w-4" style={{ color: "hsl(155 45% 40%)" }} />
                <span className="text-sm font-medium" style={{ color: "hsl(155 45% 30%)" }}>Total: {totalPreview}h</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Descripción del trabajo</label>
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Poda de setos, limpieza general..." rows={3} className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>

            <button type="submit" disabled={submitting} className="w-full py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all disabled:opacity-50 rounded-sm" style={{ backgroundColor: "hsl(155 40% 20%)", color: "hsl(0 0% 98%)", border: "1px solid hsl(155 40% 30%)" }}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Guardar registro"}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      {!showForm && (
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label: "Este mes", action: () => setPreset("mes") },
              { label: "Mes anterior", action: () => setPreset("anterior") },
              { label: "Todo", action: () => setPreset("todo") },
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
          <div className="flex gap-2">
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="h-9 text-xs border-input flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aprobado">Aprobado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroJardin} onValueChange={setFiltroJardin}>
              <SelectTrigger className="h-9 text-xs border-input flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los jardines</SelectItem>
                {jardines.map(j => <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {esSupervisor && trabajadores.length > 0 && (
            <Select value={filtroTrabajador} onValueChange={setFiltroTrabajador}>
              <SelectTrigger className="h-9 text-xs border-input w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los trabajadores</SelectItem>
                {trabajadores.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {registrosFiltrados.length > 0 && (
            <button
              onClick={() => {
                const headers = ["Fecha", "Jardín", "Trabajador", "Inicio", "Fin", "Horas", "Descripción", "Estado"];
                const rows = registrosFiltrados.map(r => [
                  r.fecha, r.jardines?.nombre ?? "", r.profiles?.full_name ?? "",
                  r.hora_inicio ?? "", r.hora_fin ?? "", r.total_horas?.toString() ?? "",
                  r.descripcion ?? "", estadoConfig[r.estado].label,
                ]);
                exportCsv(`horas_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs"
              style={{ borderColor: "hsl(30 10% 80%)", color: "hsl(30 5% 40%)" }}
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(155 45% 45%)" }} /></div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay registros de horas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registrosFiltrados.map(r => {
            const cfg = estadoConfig[r.estado];
            return (
              <div key={r.id} className="rounded-sm border p-4 space-y-3" style={{ backgroundColor: "hsl(0 0% 100%)", borderColor: "hsl(30 10% 90%)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{r.jardines?.nombre}</p>
                    {esSupervisor && r.profiles?.full_name && (
                      <p className="text-xs mt-0.5" style={{ color: "hsl(30 5% 55%)" }}>{r.profiles.full_name}</p>
                    )}
                  </div>
                  <span className="text-xs shrink-0" style={{ color: "hsl(30 5% 55%)" }}>
                    {format(new Date(r.fecha + "T00:00:00"), "d MMM yyyy", { locale: es })}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span style={{ color: "hsl(30 5% 35%)" }}>{r.hora_inicio?.slice(0,5)} - {r.hora_fin?.slice(0,5)}</span>
                  {r.total_horas != null && (
                    <span className="font-semibold" style={{ color: "hsl(155 45% 30%)" }}>{r.total_horas}h</span>
                  )}
                </div>

                {r.descripcion && (
                  <p className="text-sm" style={{ color: "hsl(30 5% 35%)" }}>{r.descripcion}</p>
                )}

                <div className="flex items-center justify-between pt-1">
                  {esSupervisor ? (
                    <Select value={r.estado} onValueChange={v => updateEstado(r.id, v as EstadoRegistro)} disabled={updating === r.id}>
                      <SelectTrigger className="h-7 w-36 text-xs">
                        {updating === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="aprobado">Aprobado</SelectItem>
                        <SelectItem value="rechazado">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-sm" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
