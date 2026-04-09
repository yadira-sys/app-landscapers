import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Plus, Loader2, X, Download, Camera, Car } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { exportCsv } from "@/lib/exportCsv";

type EstadoRegistro = "pendiente" | "aprobado" | "rechazado";
type TipoExtra = "reparacion_urgente" | "material_adicional" | "fuera_horario" | "otro";

interface Extra {
  id: string;
  usuario_id: string;
  jardin_id: string;
  fecha: string;
  tipo: TipoExtra;
  descripcion: string;
  horas: number | null;
  importe: number | null;
  foto_url: string | null;
  con_desplazamiento: boolean;
  estado: EstadoRegistro;
  notas_revision: string | null;
  created_at: string;
  jardines: { nombre: string } | null;
  profiles: { full_name: string } | null;
}

interface Jardin { id: string; nombre: string; }

const tipoLabels: Record<TipoExtra, string> = {
  reparacion_urgente: "Reparación urgente",
  material_adicional: "Material adicional",
  fuera_horario: "Fuera de horario",
  otro: "Otro",
};

const estadoConfig: Record<EstadoRegistro, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "hsl(38 90% 50%)",  bg: "hsl(38 90% 50% / 0.12)" },
  aprobado:  { label: "Aprobado",  color: "hsl(155 45% 40%)", bg: "hsl(155 45% 40% / 0.12)" },
  rechazado: { label: "Rechazado", color: "hsl(0 72% 51%)",   bg: "hsl(0 72% 51% / 0.12)" },
};

export default function TrabajosExtras() {
  const { user, isAdmin, isEncargado, profile } = useAuth();
  const { toast } = useToast();
  const esSupervisor = isAdmin || isEncargado;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [extras, setExtras] = useState<Extra[]>([]);
  const [jardines, setJardines] = useState<Jardin[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Filters
  const [fechaDesde, setFechaDesde] = useState(startOfMonth(new Date()).toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(endOfMonth(new Date()).toISOString().split("T")[0]);
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Form
  const [jardinId, setJardinId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [tipo, setTipo] = useState<TipoExtra>("otro");
  const [descripcion, setDescripcion] = useState("");
  const [horas, setHoras] = useState("");
  const [importe, setImporte] = useState("");
  const [conDesplazamiento, setConDesplazamiento] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const fetchData = async () => {
    const [jardinesRes, extrasRes] = await Promise.all([
      (() => {
        let q = supabase.from("jardines").select("id, nombre").eq("activo", true);
        if (!isAdmin) q = q.eq("admin_only", false);
        return q.order("nombre");
      })(),
      supabase
        .from("trabajos_extras")
        .select("id, usuario_id, jardin_id, fecha, tipo, descripcion, horas, importe, foto_url, con_desplazamiento, estado, notas_revision, created_at, jardines(nombre), profiles!trabajos_extras_usuario_id_fkey(full_name)")
        .gte("fecha", fechaDesde)
        .lte("fecha", fechaHasta)
        .order("fecha", { ascending: false })
        .limit(300),
    ]);
    if (jardinesRes.data) setJardines(jardinesRes.data);
    if (extrasRes.data) setExtras(extrasRes.data as unknown as Extra[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [isAdmin, fechaDesde, fechaHasta]);

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

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setFotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const cancelForm = () => {
    setShowForm(false);
    setJardinId(""); setFecha(new Date().toISOString().split("T")[0]);
    setTipo("otro"); setDescripcion(""); setHoras(""); setImporte("");
    setConDesplazamiento(false); setFotoFile(null); setFotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jardinId || !descripcion.trim()) {
      toast({ title: "Rellena jardín y descripción", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    let fotoUrl: string | null = null;
    if (fotoFile) {
      const ext = fotoFile.name.split(".").pop() ?? "jpg";
      const path = `extras/${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("extras-fotos")
        .upload(path, fotoFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("extras-fotos").getPublicUrl(path);
        fotoUrl = urlData.publicUrl;
      }
    }

    const { data: insertedData, error } = await supabase
      .from("trabajos_extras")
      .insert({
        usuario_id: user!.id,
        jardin_id: jardinId,
        fecha,
        tipo,
        descripcion: descripcion.trim(),
        horas: horas ? parseFloat(horas) : null,
        importe: importe ? parseFloat(importe) : null,
        con_desplazamiento: conDesplazamiento,
        foto_url: fotoUrl,
      } as any)
      .select("id")
      .single();

    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Trabajo extra registrado" });
      cancelForm();
      await fetchData();
    }
    setSubmitting(false);
  };

  const updateEstado = async (id: string, estado: EstadoRegistro) => {
    setUpdating(id);
    const { error } = await supabase.from("trabajos_extras").update({ estado } as any).eq("id", id);
    if (error) {
      toast({ title: "Error al actualizar", variant: "destructive" });
    } else {
      toast({ title: "✅ Estado actualizado" });
      await fetchData();
    }
    setUpdating(null);
  };

  const extrasFiltrados = extras.filter(e => filtroEstado === "todos" || e.estado === filtroEstado);

  return (
    <div className="p-5 space-y-5">
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="foto" className="max-w-full max-h-full object-contain rounded" />
        </div>
      )}

      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-light tracking-wide">Trabajos Extras</h1>
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
          {showForm ? "Cancelar" : "Nuevo"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-sm border p-4 space-y-4" style={{ borderColor: "hsl(155 40% 70%)", borderLeftWidth: "3px", borderLeftColor: "hsl(155 40% 40%)" }}>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "hsl(155 40% 38%)" }}>Nuevo trabajo extra</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Jardín *</label>
              <Select value={jardinId} onValueChange={setJardinId}>
                <SelectTrigger className="h-9 text-sm border-input">
                  <SelectValue placeholder="Selecciona jardín..." />
                </SelectTrigger>
                <SelectContent>
                  {jardines.map(j => <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Tipo de trabajo *</label>
              <Select value={tipo} onValueChange={v => setTipo(v as TipoExtra)}>
                <SelectTrigger className="h-9 text-sm border-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Horas</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={horas}
                  onChange={e => setHoras(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Importe (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={importe}
                onChange={e => setImporte(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Descripción *</label>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Describe el trabajo extra realizado..."
                rows={3}
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Desplazamiento */}
            <div
              className="flex items-center justify-between py-2.5 px-3 rounded-sm"
              style={{ backgroundColor: "hsl(30 10% 97%)", border: "1px solid hsl(30 10% 90%)" }}
            >
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4" style={{ color: conDesplazamiento ? "hsl(155 45% 40%)" : "hsl(30 5% 55%)" }} />
                <span className="text-sm" style={{ color: "hsl(30 5% 35%)" }}>Incluye desplazamiento</span>
              </div>
              <button
                type="button"
                onClick={() => setConDesplazamiento(!conDesplazamiento)}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                style={{ backgroundColor: conDesplazamiento ? "hsl(155 45% 40%)" : "hsl(30 10% 80%)" }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                  style={{ transform: conDesplazamiento ? "translateX(16px)" : "translateX(2px)" }}
                />
              </button>
            </div>

            {/* Foto */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Foto del trabajo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoChange}
                className="hidden"
              />
              {fotoPreview ? (
                <div className="relative">
                  <img src={fotoPreview} alt="preview" className="w-full h-32 object-cover rounded-sm border" />
                  <button
                    type="button"
                    onClick={() => { setFotoFile(null); setFotoPreview(null); }}
                    className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-sm border border-dashed flex items-center justify-center gap-2 text-xs transition-colors"
                  style={{ borderColor: "hsl(30 10% 80%)", color: "hsl(30 5% 48%)" }}
                >
                  <Camera className="h-4 w-4" /> Añadir foto
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all disabled:opacity-50 rounded-sm"
              style={{ backgroundColor: "hsl(155 40% 20%)", color: "hsl(0 0% 98%)", border: "1px solid hsl(155 40% 30%)" }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Guardar extra"}
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
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
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
            {extrasFiltrados.length > 0 && (
              <button
                onClick={() => {
                  const headers = ["Fecha", "Jardín", "Trabajador", "Tipo", "Descripción", "Horas", "Importe (€)", "Desplazamiento", "Estado"];
                  const rows = extrasFiltrados.map(e => [
                    e.fecha, e.jardines?.nombre ?? "", e.profiles?.full_name ?? "",
                    tipoLabels[e.tipo], e.descripcion,
                    e.horas?.toString() ?? "", e.importe?.toString() ?? "",
                    e.con_desplazamiento ? "Sí" : "No",
                    estadoConfig[e.estado].label,
                  ]);
                  exportCsv(`extras_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
                }}
                className="h-9 px-3 rounded-sm border flex items-center gap-1.5 text-xs shrink-0"
                style={{ borderColor: "hsl(30 10% 80%)", color: "hsl(30 5% 40%)" }}
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(155 45% 45%)" }} />
        </div>
      ) : extrasFiltrados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wrench className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay trabajos extras registrados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {extrasFiltrados.map(ex => {
            const cfg = estadoConfig[ex.estado];
            return (
              <div
                key={ex.id}
                className="rounded-sm border p-4 space-y-3"
                style={{ backgroundColor: "hsl(0 0% 100%)", borderColor: "hsl(30 10% 90%)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{ex.jardines?.nombre}</p>
                    {esSupervisor && ex.profiles?.full_name && (
                      <p className="text-xs mt-0.5" style={{ color: "hsl(30 5% 55%)" }}>{ex.profiles.full_name}</p>
                    )}
                  </div>
                  <span className="text-xs shrink-0" style={{ color: "hsl(30 5% 55%)" }}>
                    {format(new Date(ex.fecha + "T00:00:00"), "d MMM yyyy", { locale: es })}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-sm"
                    style={{ backgroundColor: "hsl(45 65% 48% / 0.12)", color: "hsl(45 65% 35%)" }}
                  >
                    {tipoLabels[ex.tipo]}
                  </span>
                  {ex.horas != null && (
                    <span className="text-xs font-medium" style={{ color: "hsl(155 45% 30%)" }}>{ex.horas}h</span>
                  )}
                  {ex.importe != null && (
                    <span className="text-xs font-semibold" style={{ color: "hsl(210 60% 40%)" }}>{ex.importe.toFixed(2)}€</span>
                  )}
                  {ex.con_desplazamiento && (
                    <span
                      className="flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-sm"
                      style={{ backgroundColor: "hsl(210 60% 40% / 0.1)", color: "hsl(210 60% 35%)" }}
                    >
                      <Car className="h-3 w-3" /> Desplazamiento
                    </span>
                  )}
                </div>

                <p className="text-sm" style={{ color: "hsl(30 5% 35%)" }}>{ex.descripcion}</p>

                {ex.foto_url && (
                  <img
                    src={ex.foto_url}
                    alt="foto trabajo"
                    className="w-full h-28 object-cover rounded-sm cursor-pointer"
                    onClick={() => setLightboxUrl(ex.foto_url)}
                  />
                )}

                {ex.notas_revision && (
                  <div className="text-xs px-3 py-2 rounded-sm" style={{ backgroundColor: "hsl(120 10% 95%)", color: "hsl(30 5% 40%)" }}>
                    <strong>Nota:</strong> {ex.notas_revision}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  {esSupervisor ? (
                    <Select
                      value={ex.estado}
                      onValueChange={v => updateEstado(ex.id, v as EstadoRegistro)}
                      disabled={updating === ex.id}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        {updating === ex.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="aprobado">Aprobado</SelectItem>
                        <SelectItem value="rechazado">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-sm"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
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
