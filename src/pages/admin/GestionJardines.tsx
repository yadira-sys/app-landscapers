import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TreePine, Plus, Loader2, MapPin, Trash2, UserPlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DIAS_SEMANA = [
  { value: "lunes", label: "L" },
  { value: "martes", label: "M" },
  { value: "miercoles", label: "X" },
  { value: "jueves", label: "J" },
  { value: "viernes", label: "V" },
  { value: "sabado", label: "S" },
  { value: "domingo", label: "D" },
];

interface AsignacionJardinero {
  id: string;
  full_name: string;
  dias_semana: string[];
  asignacion_id: string;
}

interface Jardin {
  id: string;
  nombre: string;
  direccion: string | null;
  descripcion: string | null;
  activo: boolean;
  jardineros: AsignacionJardinero[];
}

interface Trabajador {
  id: string;
  full_name: string;
}

export default function GestionJardines() {
  const { toast } = useToast();
  const [jardines, setJardines] = useState<Jardin[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedJardinero, setSelectedJardinero] = useState("");
  const [selectedDias, setSelectedDias] = useState<string[]>([]);
  const [form, setForm] = useState({ nombre: "", direccion: "", descripcion: "" });
  const [editingDias, setEditingDias] = useState<string | null>(null); // asignacion_id
  const [editDias, setEditDias] = useState<string[]>([]);

  const fetchData = async () => {
    const [jardinesRes, asignacionesRes, profilesRes] = await Promise.all([
      supabase.from("jardines").select("*").order("nombre"),
      supabase.from("asignaciones").select("id, jardin_id, jardinero_id, dias_semana, profiles!asignaciones_jardinero_id_profiles_fkey(id, full_name)").eq("activo", true),
      supabase.from("profiles").select("id, full_name"),
    ]);

    if (jardinesRes.data) {
      const asignMap: Record<string, AsignacionJardinero[]> = {};
      (asignacionesRes.data ?? []).forEach(a => {
        if (a.profiles) {
          if (!asignMap[a.jardin_id]) asignMap[a.jardin_id] = [];
          asignMap[a.jardin_id].push({
            id: a.profiles.id,
            full_name: a.profiles.full_name,
            dias_semana: Array.isArray(a.dias_semana) ? a.dias_semana : [],
            asignacion_id: a.id,
          });
        }
      });
      setJardines(jardinesRes.data.map((j) => ({ ...j, jardineros: asignMap[j.id] ?? [] })));
    }

    if (profilesRes.data) {
      setTrabajadores(profilesRes.data.filter((p) => p.full_name));
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("jardines").insert({
      nombre: form.nombre,
      direccion: form.direccion || null,
      descripcion: form.descripcion || null,
    });
    if (error) toast({ title: "Error al crear jardín", variant: "destructive" });
    else {
      toast({ title: "✅ Jardín creado" });
      setOpen(false);
      setForm({ nombre: "", direccion: "", descripcion: "" });
      await fetchData();
    }
    setSubmitting(false);
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    await supabase.from("jardines").update({ activo: !activo }).eq("id", id);
    toast({ title: activo ? "Jardín desactivado" : "✅ Jardín activado" });
    await fetchData();
  };

  const eliminarJardin = async (id: string) => {
    await supabase.from("asignaciones").update({ activo: false }).eq("jardin_id", id);
    const { error } = await supabase.from("jardines").delete().eq("id", id);
    if (error) toast({ title: "Error al eliminar jardín", variant: "destructive" });
    else { toast({ title: "Jardín eliminado" }); await fetchData(); }
  };

  const toggleDia = (dia: string) => {
    setSelectedDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const asignarJardinero = async (jardinId: string) => {
    if (!selectedJardinero) return;
    // Check if already assigned
    const jardin = jardines.find(j => j.id === jardinId);
    if (jardin?.jardineros.some(jn => jn.id === selectedJardinero)) {
      toast({ title: "Este trabajador ya está asignado", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("asignaciones").insert({
      jardin_id: jardinId,
      jardinero_id: selectedJardinero,
      activo: true,
      dias_semana: selectedDias,
    });
    if (error) toast({ title: "Error al asignar", variant: "destructive" });
    else {
      toast({ title: "✅ Jardinero asignado" });
      setAssignOpen(null);
      setSelectedJardinero("");
      setSelectedDias([]);
      await fetchData();
    }
  };

  const quitarJardinero = async (asignacionId: string) => {
    await supabase.from("asignaciones").update({ activo: false }).eq("id", asignacionId);
    toast({ title: "Jardinero quitado" });
    await fetchData();
  };

  const startEditDias = (asignacionId: string, currentDias: string[]) => {
    setEditingDias(asignacionId);
    setEditDias([...currentDias]);
  };

  const toggleEditDia = (dia: string) => {
    setEditDias((prev) => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]);
  };

  const saveEditDias = async () => {
    if (!editingDias) return;
    await supabase.from("asignaciones").update({ dias_semana: editDias }).eq("id", editingDias);
    toast({ title: "✅ Días actualizados" });
    setEditingDias(null);
    await fetchData();
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
          <TreePine className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Jardines</h1>
          <span className="text-sm text-muted-foreground">({jardines.length})</span>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nuevo Jardín</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Nombre del jardín" />
              </div>
              <div className="space-y-2">
                <Label>Dirección / Zona</Label>
                <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Ej: Sierra Blanca" />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Notas sobre el jardín..." rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !form.nombre}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Crear jardín
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {jardines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay jardines creados todavía.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jardines.map((j) => (
            <Card key={j.id} className={!j.activo ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{j.nombre}</p>
                      <Badge variant={j.activo ? "default" : "secondary"} className="text-xs">
                        {j.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    {j.direccion && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{j.direccion}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="text-xs h-7 px-2"
                      onClick={() => toggleActivo(j.id, j.activo)}>
                      {j.activo ? "Desactivar" : "Activar"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar jardín?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminará <strong>{j.nombre}</strong> y todas sus asignaciones. Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => eliminarJardin(j.id)}
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Jardineros asignados */}
                <div className="pt-1 border-t border-border/50 space-y-2">
                  {j.jardineros.length > 0 ? (
                    <div className="space-y-1.5">
                      {j.jardineros.map((jn) => (
                        <div key={jn.asignacion_id} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-foreground truncate">👤 {jn.full_name}</span>
                              {editingDias !== jn.asignacion_id && (
                                <button onClick={() => startEditDias(jn.asignacion_id, jn.dias_semana)} className="flex gap-0.5">
                                  {DIAS_SEMANA.map((d) => (
                                    <span
                                      key={d.value}
                                      className={`w-4 h-4 rounded text-[9px] flex items-center justify-center font-medium ${
                                        jn.dias_semana.includes(d.value)
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-muted text-muted-foreground/30"
                                      }`}
                                    >
                                      {d.label}
                                    </span>
                                  ))}
                                </button>
                              )}
                            </div>
                            <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => quitarJardinero(jn.asignacion_id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          {editingDias === jn.asignacion_id && (
                            <div className="flex items-center gap-1.5 pl-6">
                              {DIAS_SEMANA.map((d) => (
                                <button
                                  key={d.value}
                                  type="button"
                                  onClick={() => toggleEditDia(d.value)}
                                  className={`w-6 h-6 rounded text-[10px] font-semibold transition-colors ${
                                    editDias.includes(d.value)
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              ))}
                              <Button size="sm" variant="default" className="h-6 text-[10px] px-2 ml-1" onClick={saveEditDias}>OK</Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1" onClick={() => setEditingDias(null)}>✕</Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sin jardineros asignados</p>
                  )}

                  {/* Add button */}
                  <Dialog open={assignOpen === j.id} onOpenChange={(v) => {
                    setAssignOpen(v ? j.id : null);
                    if (v) { setSelectedJardinero(""); setSelectedDias([]); }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1">
                        <UserPlus className="h-3 w-3" /> Añadir jardinero
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xs">
                      <DialogHeader>
                        <DialogTitle>Asignar jardinero</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">{j.nombre}</p>
                      <Select value={selectedJardinero} onValueChange={setSelectedJardinero}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar trabajador..." />
                        </SelectTrigger>
                        <SelectContent>
                          {trabajadores
                            .filter(t => !j.jardineros.some(jn => jn.id === t.id))
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {/* Day selection */}
                      <div className="space-y-2">
                        <Label className="text-xs">Días asignados</Label>
                        <div className="flex gap-2 flex-wrap">
                          {DIAS_SEMANA.map((d) => (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => toggleDia(d.value)}
                              className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors ${
                                selectedDias.includes(d.value)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button className="w-full" disabled={!selectedJardinero} onClick={() => asignarJardinero(j.id)}>
                        Confirmar asignación
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
