import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Plus, X, Camera } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type Urgencia = "alta" | "media" | "baja";
type Estado = "abierta" | "en_proceso" | "resuelta";

interface Incidencia {
  id: string;
  descripcion: string;
  urgencia: Urgencia;
  estado: Estado;
  foto_url: string | null;
  notas_resolucion: string | null;
  created_at: string;
  jardin_id: string;
  jardines: { nombre: string } | null;
  profiles: { full_name: string } | null;
}

interface Jardin { id: string; nombre: string; }

const urgenciaConfig: Record<Urgencia, { label: string; className: string }> = {
  alta: { label: "Alta", className: "urgencia-alta bg-urgencia-alta" },
  media: { label: "Media", className: "urgencia-media bg-urgencia-media" },
  baja: { label: "Baja", className: "urgencia-baja bg-urgencia-baja" },
};

export default function GestionIncidencias() {
  const { user, isAdmin, isEncargado } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [filtroEstado, setFiltroEstado] = useState<string>("todas");
  const [filtroUrgencia, setFiltroUrgencia] = useState<string>("todas");
  const [updating, setUpdating] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jardinId, setJardinId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [urgencia, setUrgencia] = useState<Urgencia>("media");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const canEdit = isAdmin || isEncargado;

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

  const { data: incidencias = [], isLoading: loading } = useQuery<Incidencia[]>({
    queryKey: ["incidencias", filtroEstado, filtroUrgencia],
    queryFn: async () => {
      let q = supabase
        .from("incidencias")
        .select("id, descripcion, urgencia, estado, foto_url, notas_resolucion, created_at, jardin_id, jardines(nombre), profiles!incidencias_jardinero_id_profiles_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (filtroEstado !== "todas") q = q.eq("estado", filtroEstado as Estado);
      if (filtroUrgencia !== "todas") q = q.eq("urgencia", filtroUrgencia as Urgencia);
      const { data } = await q;
      return (data ?? []) as unknown as Incidencia[];
    },
  });

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
    setJardinId("");
    setDescripcion("");
    setUrgencia("media");
    clearFoto();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jardinId || !descripcion.trim()) {
      toast({ title: "Rellena jardín y descripción", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    let foto_url: string | null = null;
    if (fotoFile) {
      const ext = fotoFile.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("incidencias-fotos").upload(path, fotoFile);
      if (uploadError) {
        toast({ title: "Error subiendo foto", description: uploadError.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("incidencias-fotos").getPublicUrl(path);
      foto_url = urlData.publicUrl;
    }

    const { error } = await supabase.from("incidencias").insert({
      jardin_id: jardinId,
      jardinero_id: user!.id,
      descripcion: descripcion.trim(),
      urgencia,
      foto_url,
    });

    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Incidencia registrada" });
      cancelForm();
      queryClient.invalidateQueries({ queryKey: ["incidencias"] });
      queryClient.invalidateQueries({ queryKey: ["alerta-incidencias"] });
    }
    setSubmitting(false);
  };

  const updateEstado = async (id: string, estado: Estado) => {
    setUpdating(id);
    const { error } = await supabase.from("incidencias").update({ estado }).eq("id", id);
    if (error) {
      toast({ title: "Error al actualizar", variant: "destructive" });
    } else {
      toast({ title: "Estado actualizado" });
      queryClient.invalidateQueries({ queryKey: ["incidencias"] });
      queryClient.invalidateQueries({ queryKey: ["alerta-incidencias"] });
    }
    setUpdating(null);
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-light tracking-wide">Incidencias</h1>
          <div className="h-px w-12 mt-2" style={{ backgroundColor: "hsl(0 72% 51%)" }} />
        </div>
        <button
          onClick={() => showForm ? cancelForm() : setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium tracking-wide uppercase rounded-sm transition-all"
          style={showForm
            ? { backgroundColor: "hsl(0 0% 90%)", color: "hsl(30 5% 30%)", border: "1px solid hsl(0 0% 80%)" }
            : { backgroundColor: "hsl(0 72% 45%)", color: "hsl(0 0% 98%)", border: "1px solid hsl(0 72% 55%)" }
          }
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancelar" : "Nueva"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-sm border p-4 space-y-4" style={{ borderColor: "hsl(0 72% 70%)", borderLeftWidth: "3px", borderLeftColor: "hsl(0 72% 50%)" }}>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "hsl(0 72% 45%)" }}>Nueva incidencia</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Jardín *</label>
              <Select value={jardinId} onValueChange={setJardinId}>
                <SelectTrigger className="h-9 text-sm border-input"><SelectValue placeholder="Selecciona jardín..." /></SelectTrigger>
                <SelectContent>{jardines.map(j => <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Urgencia</label>
              <Select value={urgencia} onValueChange={v => setUrgencia(v as Urgencia)}>
                <SelectTrigger className="h-9 text-sm border-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Descripción *</label>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej: Riego roto en zona norte, falta planta en maceta entrada..."
                rows={3}
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Photo */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 5% 48%)" }}>Foto (opcional)</label>
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

            <button type="submit" disabled={submitting} className="w-full py-3 text-xs tracking-[0.2em] uppercase font-medium transition-all disabled:opacity-50 rounded-sm" style={{ backgroundColor: "hsl(0 72% 45%)", color: "hsl(0 0% 98%)", border: "1px solid hsl(0 72% 55%)" }}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Registrar incidencia"}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      {!showForm && (
        <div className="flex gap-2">
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="flex-1 h-9 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los estados</SelectItem>
              <SelectItem value="abierta">Abierta</SelectItem>
              <SelectItem value="en_proceso">En proceso</SelectItem>
              <SelectItem value="resuelta">Resuelta</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroUrgencia} onValueChange={setFiltroUrgencia}>
            <SelectTrigger className="flex-1 h-9 text-xs">
              <SelectValue placeholder="Urgencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Toda urgencia</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(0 72% 51%)" }} />
        </div>
      ) : incidencias.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay incidencias con estos filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidencias.map((inc) => {
            const urg = urgenciaConfig[inc.urgencia];
            return (
              <div key={inc.id} className="rounded-sm border p-4 space-y-3" style={{ backgroundColor: "hsl(0 0% 100%)", borderColor: "hsl(30 10% 90%)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{inc.jardines?.nombre}</p>
                    <p className="text-xs mt-0.5" style={{ color: "hsl(30 5% 55%)" }}>{inc.profiles?.full_name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={cn("border-0 text-xs", urg.className)}>
                      {urg.label}
                    </Badge>
                    <span className="text-xs" style={{ color: "hsl(30 5% 55%)" }}>
                      {format(new Date(inc.created_at), "d MMM, HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>

                <p className="text-sm" style={{ color: "hsl(30 5% 25%)" }}>{inc.descripcion}</p>

                {inc.foto_url && (
                  <button onClick={() => setFotoAmpliada(inc.foto_url)} className="w-full rounded-sm overflow-hidden block">
                    <img src={inc.foto_url} alt="Foto incidencia" className="w-full object-cover max-h-36 hover:opacity-90 transition-opacity" />
                  </button>
                )}

                {inc.notas_resolucion && (
                  <p className="text-xs italic px-2 py-1 rounded" style={{ backgroundColor: "hsl(155 45% 40% / 0.08)", color: "hsl(155 45% 30%)" }}>
                    Resolución: {inc.notas_resolucion}
                  </p>
                )}

                <div className="flex items-center justify-end pt-1">
                  {canEdit ? (
                    <Select
                      value={inc.estado}
                      onValueChange={(v) => updateEstado(inc.id, v as Estado)}
                      disabled={updating === inc.id}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="abierta">Abierta</SelectItem>
                        <SelectItem value="en_proceso">En proceso</SelectItem>
                        <SelectItem value="resuelta">Resuelta</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {inc.estado === "abierta" ? "Abierta" : inc.estado === "en_proceso" ? "En proceso" : "Resuelta"}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {fotoAmpliada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setFotoAmpliada(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-black/50" onClick={() => setFotoAmpliada(null)}>
            <X className="h-5 w-5 text-white" />
          </button>
          <img src={fotoAmpliada} alt="Foto ampliada" className="max-w-full max-h-full object-contain rounded" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
