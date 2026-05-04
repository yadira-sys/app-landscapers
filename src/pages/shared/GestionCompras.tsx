import { useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Plus, Loader2, Camera, X, Receipt, Download, Filter, CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import ResumenGastos from "@/components/ResumenGastos";
import { exportCsv } from "@/lib/exportCsv";

type TipoGasto = "combustible" | "herramientas" | "material" | "comida" | "otro";

interface Compra {
  id: string;
  descripcion: string;
  fecha: string;
  foto_factura_url: string | null;
  estado_cobro: string;
  importe: number | null;
  tipo_gasto: TipoGasto;
  created_at: string;
  jardin_id: string | null;
  registrado_por: string;
  jardines: { nombre: string } | null;
  profiles: { full_name: string } | null;
}

interface Jardin { id: string; nombre: string; }

const tipoGastoLabels: Record<TipoGasto, string> = {
  combustible: "Combustible",
  herramientas: "Herramientas",
  material: "Material",
  comida: "Comida",
  otro: "Otro",
};

const estadoConfig: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:    { label: "Pendiente",    color: "hsl(38 90% 50%)",  bg: "hsl(38 90% 50% / 0.12)" },
  aprobado:     { label: "Aprobado",     color: "hsl(155 45% 40%)", bg: "hsl(155 45% 40% / 0.12)" },
  rechazado:    { label: "Rechazado",    color: "hsl(0 72% 51%)",   bg: "hsl(0 72% 51% / 0.12)" },
  se_cobra:     { label: "Se cobra",     color: "hsl(155 45% 40%)", bg: "hsl(155 45% 40% / 0.12)" },
  no_se_cobra:  { label: "No se cobra",  color: "hsl(30 5% 48%)",   bg: "hsl(30 5% 48% / 0.10)" },
};

export default function GestionCompras() {
  const { user, isAdmin, isEncargado, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const esSupervisor = isAdmin || isEncargado;
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [jardinId, setJardinId] = useState("");
  const [conceptoExtra, setConceptoExtra] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [importe, setImporte] = useState("");
  const [tipoGasto, setTipoGasto] = useState<TipoGasto>("otro");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  // Filters
  const now = new Date();
  const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [fechaHasta, setFechaHasta] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [filtroJardin, setFiltroJardin] = useState("todos");
  const [showFilters, setShowFilters] = useState(false);

  // --- React Query: jardines (cached, rarely changes) ---
  const { data: jardines = [] } = useQuery<Jardin[]>({
    queryKey: ["jardines-activos", isAdmin],
    queryFn: async () => {
      let q = supabase.from("jardines").select("id, nombre").eq("activo", true);
      if (!isAdmin) q = q.eq("admin_only", false);
      const { data } = await q.order("nombre");
      return (data ?? []) as Jardin[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // --- React Query: compras (filtered at DB level) ---
  const { data: compras = [], isLoading: loading } = useQuery<Compra[]>({
    queryKey: ["compras", fechaDesde, fechaHasta, filtroJardin],
    queryFn: async () => {
      let q = supabase
        .from("compras")
        .select("id, descripcion, fecha, foto_factura_url, estado_cobro, importe, tipo_gasto, created_at, jardin_id, registrado_por, jardines(nombre), profiles!compras_registrado_por_fkey(full_name)")
        .gte("fecha", fechaDesde)
        .lte("fecha", fechaHasta)
        .order("fecha", { ascending: false });

      if (filtroJardin !== "todos") {
        q = q.eq("jardin_id", filtroJardin);
      }

      const { data } = await q;
      return (data ?? []) as unknown as Compra[];
    },
  });

  // Quick presets for date filters
  const setPreset = (preset: "month" | "prev" | "all") => {
    if (preset === "month") {
      setFechaDesde(format(startOfMonth(now), "yyyy-MM-dd"));
      setFechaHasta(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (preset === "prev") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setFechaDesde(format(startOfMonth(prev), "yyyy-MM-dd"));
      setFechaHasta(format(endOfMonth(prev), "yyyy-MM-dd"));
    } else {
      setFechaDesde("2020-01-01");
      setFechaHasta("2099-12-31");
    }
  };

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const clearFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const cancelForm = () => {
    setShowForm(false);
    setJardinId(""); setConceptoExtra(""); setDescripcion(""); setFecha(new Date().toISOString().split("T")[0]);
    setImporte(""); setTipoGasto("otro"); clearFoto();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jardinId || !descripcion.trim()) {
      toast({ title: "Rellena jardín y descripción", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    let foto_factura_url: string | null = null;
    if (fotoFile) {
      const ext = fotoFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("compras-fotos").upload(path, fotoFile);
      if (uploadError) {
        toast({ title: "Error subiendo foto", description: uploadError.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("compras-fotos").getPublicUrl(path);
      foto_factura_url = urlData.publicUrl;
    }

    const { data: insertedData, error } = await supabase.from("compras").insert({
      jardin_id: esTrabajoExtra ? null : jardinId,
      registrado_por: user!.id,
      descripcion: esTrabajoExtra && conceptoExtra.trim() ? `[${conceptoExtra.trim()}] ${descripcion.trim()}`.trim() : descripcion.trim(),
      fecha,
      importe: importe ? parseFloat(importe) : null,
      tipo_gasto: tipoGasto,
      foto_factura_url,
      estado_cobro: "pendiente",
    }).select("id").single();

    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Gasto registrado" });
      cancelForm();
      queryClient.invalidateQueries({ queryKey: ["compras"] });
    }
    setSubmitting(false);
  };

  // Filtered label for header
  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (fechaDesde !== "2020-01-01" || fechaHasta !== "2099-12-31") {
      parts.push(`${format(new Date(fechaDesde + "T00:00:00"), "d MMM", { locale: es })} – ${format(new Date(fechaHasta + "T00:00:00"), "d MMM yyyy", { locale: es })}`);
    }
    if (filtroJardin !== "todos") {
      const j = jardines.find(j => j.id === filtroJardin);
      if (j) parts.push(j.nombre);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [fechaDesde, fechaHasta, filtroJardin, jardines]);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-light tracking-wide">Gastos</h1>
          <div className="h-px w-12 mt-2" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
          {filterLabel && (
            <p className="text-[10px] mt-1.5 tracking-wide" style={{ color: "hsl(30 5% 55%)" }}>{filterLabel}</p>
          )}
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
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "hsl(155 40% 38%)" }}>Nuevo gasto</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Jardín *</label>
              <Select value={jardinId} onValueChange={setJardinId}>
                <SelectTrigger className="h-9 text-sm border-input"><SelectValue placeholder="Selecciona jardín..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__trabajo_extra__">⚒ Trabajo Extra</SelectItem>
                  {jardines.map(j => <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Tipo de gasto *</label>
              <Select value={tipoGasto} onValueChange={v => setTipoGasto(v as TipoGasto)}>
                <SelectTrigger className="h-9 text-sm border-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoGastoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Concepto / descripción *</label>
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: 3 sacos sustrato, herbicida..." rows={3} className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Importe (€)</label>
                <input type="number" step="0.01" min="0" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0.00" className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
            </div>

            {/* Photo */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Foto ticket/factura (obligatorio)</label>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
              {fotoPreview ? (
                <div className="relative rounded-sm overflow-hidden">
                  <img src={fotoPreview} alt="Preview" className="w-full max-h-52 object-cover" />
                  <button type="button" onClick={clearFoto} className="absolute top-2 right-2 p-1.5 rounded-full" style={{ backgroundColor: "hsl(0 0% 10% / 0.7)" }}>
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full border border-dashed rounded-sm py-8 flex flex-col items-center gap-2 transition-colors" style={{ borderColor: "hsl(30 10% 80%)", color: "hsl(30 5% 55%)" }}>
                  <Camera className="h-6 w-6 opacity-50" />
                  <span className="text-xs uppercase tracking-wide">Añadir foto</span>
                </button>
              )}
            </div>

            <button type="submit" disabled={submitting} className="w-full py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all disabled:opacity-50 rounded-sm" style={{ backgroundColor: "hsl(155 40% 20%)", color: "hsl(0 0% 98%)", border: "1px solid hsl(155 40% 30%)" }}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Guardar gasto"}
            </button>
          </form>
        </div>
      )}

      {/* Filters + actions */}
      {!showForm && (
        <>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="h-9 px-3 rounded-sm border flex items-center gap-1.5 text-xs"
              style={{
                borderColor: showFilters ? "hsl(155 40% 50%)" : "hsl(30 10% 80%)",
                color: showFilters ? "hsl(155 40% 30%)" : "hsl(30 5% 40%)",
                backgroundColor: showFilters ? "hsl(155 40% 95%)" : "transparent",
              }}
            >
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            {compras.length > 0 && (
              <button
                onClick={() => {
                  const headers = ["Fecha", "Jardín", "Tipo", "Descripción", "Importe (€)", "Registrado por"];
                  const rows = compras.map(c => [
                    c.fecha, c.jardines?.nombre ?? "", tipoGastoLabels[c.tipo_gasto] ?? c.tipo_gasto,
                    c.descripcion, c.importe != null ? c.importe.toFixed(2) : "",
                    c.profiles?.full_name ?? "",
                  ]);
                  exportCsv(`gastos_${fechaDesde}_${fechaHasta}.csv`, headers, rows);
                }}
                className="h-9 px-3 rounded-sm border flex items-center gap-1.5 text-xs shrink-0"
                style={{ borderColor: "hsl(30 10% 80%)", color: "hsl(30 5% 40%)" }}
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="rounded-sm border p-4 space-y-4" style={{ borderColor: "hsl(30 10% 85%)", backgroundColor: "hsl(30 8% 98%)" }}>
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="h-3.5 w-3.5" style={{ color: "hsl(155 40% 40%)" }} />
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "hsl(30 5% 45%)" }}>Filtrar por fechas</p>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Este mes", action: () => setPreset("month") },
                  { label: "Mes anterior", action: () => setPreset("prev") },
                  { label: "Todo", action: () => setPreset("all") },
                ].map(p => (
                  <button
                    key={p.label}
                    onClick={p.action}
                    className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-medium rounded-sm border transition-colors"
                    style={{ borderColor: "hsl(30 10% 82%)", color: "hsl(30 5% 45%)" }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 55%)" }}>Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={e => setFechaDesde(e.target.value)}
                    className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 55%)" }}>Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={e => setFechaHasta(e.target.value)}
                    className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {/* Garden filter */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 55%)" }}>Jardín</label>
                <Select value={filtroJardin} onValueChange={setFiltroJardin}>
                  <SelectTrigger className="h-9 text-sm border-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los jardines</SelectItem>
                    {jardines.map(j => <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <ResumenGastos compras={compras} />
        </>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(155 45% 45%)" }} /></div>
      ) : compras.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay gastos en este período.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {compras.map(c => (
            <div key={c.id} className="rounded-sm border p-4 space-y-3" style={{ backgroundColor: "hsl(0 0% 100%)", borderColor: "hsl(30 10% 90%)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{c.jardines?.nombre}</p>
                  {esSupervisor && c.profiles?.full_name && (
                    <p className="text-xs mt-0.5" style={{ color: "hsl(30 5% 55%)" }}>{c.profiles.full_name}</p>
                  )}
                </div>
                <span className="text-xs shrink-0" style={{ color: "hsl(30 5% 55%)" }}>
                  {format(new Date(c.fecha + "T00:00:00"), "d MMM yyyy", { locale: es })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-sm" style={{ backgroundColor: "hsl(45 65% 48% / 0.12)", color: "hsl(45 65% 35%)" }}>
                  {tipoGastoLabels[c.tipo_gasto] ?? c.tipo_gasto}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm" style={{ color: "hsl(30 5% 25%)" }}>{c.descripcion}</p>
                {c.importe != null && (
                  <span className="text-sm font-semibold shrink-0" style={{ color: "hsl(155 45% 30%)" }}>{c.importe.toFixed(2)} €</span>
                )}
              </div>

              {c.foto_factura_url && (
                <button onClick={() => setFotoAmpliada(c.foto_factura_url)} className="w-full rounded-sm overflow-hidden block">
                  <img src={c.foto_factura_url} alt="Factura" className="w-full object-cover max-h-36 hover:opacity-90 transition-opacity" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {fotoAmpliada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setFotoAmpliada(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-black/50" onClick={() => setFotoAmpliada(null)}>
            <X className="h-5 w-5 text-white" />
          </button>
          <img src={fotoAmpliada} alt="Factura ampliada" className="max-w-full max-h-full object-contain rounded" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
