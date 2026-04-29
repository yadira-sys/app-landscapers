import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { AlertTriangle, Plus, Image, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Urgencia = "alta" | "media" | "baja";
type Estado = "abierta" | "en_proceso" | "resuelta";

interface Incidencia {
  id: string;
  descripcion: string;
  urgencia: Urgencia;
  estado: Estado;
  foto_url: string | null;
  created_at: string;
  jardines: { nombre: string } | null;
}

interface Jardin { id: string; nombre: string; }

const urgenciaConfig: Record<Urgencia, { label: string; className: string }> = {
  alta: { label: "Alta", className: "urgencia-alta bg-urgencia-alta" },
  media: { label: "Media", className: "urgencia-media bg-urgencia-media" },
  baja: { label: "Baja", className: "urgencia-baja bg-urgencia-baja" },
};

const estadoConfig: Record<Estado, { label: string }> = {
  abierta: { label: "Abierta" },
  en_proceso: { label: "En proceso" },
  resuelta: { label: "Resuelta" },
};

export default function IncidenciasJardinero() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [jardines, setJardines] = useState<Jardin[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    jardin_id: "",
    descripcion: "",
    urgencia: "baja" as Urgencia,
    foto: null as File | null,
  });

  const fetchData = async () => {
    if (!user) return;
    const [incRes, jardinesRes] = await Promise.all([
      supabase
        .from("incidencias")
        .select("id, descripcion, urgencia, estado, foto_url, created_at, jardines(nombre)")
        .eq("jardinero_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("jardines")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
    ]);
    if (incRes.data) setIncidencias(incRes.data as unknown as Incidencia[]);
    if (jardinesRes.data) setJardines(jardinesRes.data as Jardin[]);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.jardin_id) return;
    setSubmitting(true);

    let foto_url: string | null = null;
    if (form.foto) {
      const ext = form.foto.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("incidencias-fotos")
        .upload(path, form.foto);
      if (!uploadErr) {
        const { data } = supabase.storage.from("incidencias-fotos").getPublicUrl(path);
        foto_url = data.publicUrl;
      }
    }

    const { error } = await supabase.from("incidencias").insert({
      jardinero_id: user.id,
      jardin_id: form.jardin_id,
      descripcion: form.descripcion,
      urgencia: form.urgencia,
      foto_url,
    });

    if (error) {
      toast({ title: "Error al crear incidencia", variant: "destructive" });
    } else {
      toast({ title: "✅ Incidencia registrada" });
      setOpen(false);
      setForm({ jardin_id: "", descripcion: "", urgencia: "baja", foto: null });
      await fetchData();
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Mis Incidencias</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Nueva
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nueva Incidencia</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Jardín</Label>
                <Select value={form.jardin_id} onValueChange={(v) => setForm({ ...form, jardin_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un jardín" />
                  </SelectTrigger>
                  <SelectContent>
                    {jardines.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  placeholder="Describe la incidencia..."
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  required
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Urgencia</Label>
                <Select value={form.urgencia} onValueChange={(v) => setForm({ ...form, urgencia: v as Urgencia })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">🟢 Baja</SelectItem>
                    <SelectItem value="media">🟡 Media</SelectItem>
                    <SelectItem value="alta">🔴 Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Foto (opcional)</Label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {form.foto ? (
                    <p className="text-sm text-primary font-medium">{form.foto.name}</p>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Image className="h-6 w-6" />
                      <p className="text-xs">Toca para añadir foto</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setForm({ ...form, foto: e.target.files?.[0] ?? null })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !form.jardin_id || !form.descripcion}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Registrar incidencia
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {incidencias.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No tienes incidencias registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidencias.map((inc) => {
            const urg = urgenciaConfig[inc.urgencia];
            return (
              <Card key={inc.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm">{inc.jardines?.nombre}</p>
                    <Badge className={cn("border-0 text-xs shrink-0", urg.className)}>
                      {urg.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{inc.descripcion}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(inc.created_at), "d MMM, HH:mm", { locale: es })}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {estadoConfig[inc.estado].label}
                    </Badge>
                  </div>
                  {inc.foto_url && (
                    <img
                      src={inc.foto_url}
                      alt="Foto incidencia"
                      className="mt-3 rounded-lg w-full object-cover max-h-40"
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
