import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckSquare, Loader2, Plus, Pencil, ExternalLink, UserCheck, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Tarea {
  id: string;
  nombre: string;
  estado: string;
  prioridad: string | null;
  fecha_limite: string | null;
  asignado_a: string | null;
  notas: string | null;
  notion_url: string | null;
}

interface Trabajador {
  id: string;
  full_name: string;
  role: string | null;
}

const ESTADOS_TAREA = ["pendiente", "en_progreso", "delegada", "completada"];

const estadoLabel: Record<string, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  delegada: "Delegada",
  completada: "Completada",
};

const estadoColor: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: "hsl(0 0% 18%)", text: "hsl(0 0% 55%)" },
  en_progreso: { bg: "hsl(210 80% 50% / 0.15)", text: "hsl(210 80% 65%)" },
  delegada: { bg: "hsl(38 90% 45% / 0.15)", text: "hsl(38 90% 60%)" },
  completada: { bg: "hsl(142 55% 40% / 0.2)", text: "hsl(142 55% 55%)" },
};

const prioridadColor: Record<string, string> = {
  alta: "hsl(0 72% 60%)",
  media: "hsl(38 90% 55%)",
  baja: "hsl(0 0% 45%)",
};

export default function Tareas() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const isStaff = role === "admin" || role === "dueno" || role === "encargado";

  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("activas");
  const [editTarget, setEditTarget] = useState<Tarea | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tarea | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [fNombre, setFNombre] = useState("");
  const [fEstado, setFEstado] = useState("pendiente");
  const [fPrioridad, setFPrioridad] = useState("sin_prioridad");
  const [fFecha, setFFecha] = useState("");
  const [fAsignado, setFAsignado] = useState("sin_asignar");
  const [fNotas, setFNotas] = useState("");
  const [fNotion, setFNotion] = useState("");

  const fetchData = async () => {
    const queries: PromiseLike<{ data: unknown }>[] = [
      isStaff
        ? supabase.from("tareas").select("*").order("created_at", { ascending: false })
        : supabase.from("tareas").select("*").eq("asignado_a", user!.id).order("created_at", { ascending: false }),
    ];
    if (isStaff) {
      queries.push(
        supabase.from("profiles").select("id, full_name").then(async (res) => {
          if (!res.data) return res;
          const rolesRes = await supabase.from("user_roles").select("user_id, role");
          const rolesMap: Record<string, string> = {};
          (rolesRes.data ?? []).forEach(r => { rolesMap[r.user_id] = r.role; });
          return { data: res.data.map(p => ({ ...p, role: rolesMap[p.id] ?? null })) };
        })
      );
    }

    const [tareasRes, trabajadoresRes] = await Promise.all(queries);
    if (tareasRes?.data) setTareas(tareasRes.data as Tarea[]);
    if (trabajadoresRes?.data) setTrabajadores(trabajadoresRes.data as Trabajador[]);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const filtered = tareas.filter(t => {
    if (filtro === "activas") return t.estado !== "completada";
    if (filtro === "completadas") return t.estado === "completada";
    return t.estado === filtro;
  });

  const openEdit = (t: Tarea) => {
    setEditTarget(t);
    setFNombre(t.nombre);
    setFEstado(t.estado);
    setFPrioridad(t.prioridad ?? "sin_prioridad");
    setFFecha(t.fecha_limite ?? "");
    setFAsignado(t.asignado_a ?? "sin_asignar");
    setFNotas(t.notas ?? "");
    setFNotion(t.notion_url ?? "");
  };

  const openCreate = () => {
    setFNombre(""); setFEstado("pendiente"); setFPrioridad("sin_prioridad");
    setFFecha(""); setFAsignado("sin_asignar"); setFNotas(""); setFNotion("");
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!fNombre.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Omit<Tarea, "id"> = {
      nombre: fNombre.trim(),
      estado: fEstado,
      prioridad: fPrioridad === "sin_prioridad" ? null : fPrioridad,
      fecha_limite: fFecha || null,
      asignado_a: fAsignado === "sin_asignar" ? null : fAsignado,
      notas: fNotas.trim() || null,
      notion_url: fNotion.trim() || null,
    };
    if (editTarget) {
      const { error } = await supabase.from("tareas").update(payload).eq("id", editTarget.id);
      if (error) toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
      else { toast({ title: "Tarea actualizada" }); setEditTarget(null); fetchData(); }
    } else {
      const { error } = await supabase.from("tareas").insert(payload);
      if (error) toast({ title: "Error al crear", description: error.message, variant: "destructive" });
      else { toast({ title: "Tarea creada" }); setShowCreate(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("tareas").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    else { toast({ title: "Tarea eliminada" }); setDeleteTarget(null); fetchData(); }
    setDeleting(false);
  };

  const handleMarcarHecha = async (t: Tarea) => {
    const nuevoEstado = t.estado === "completada" ? "pendiente" : "completada";
    const { error } = await supabase.from("tareas").update({ estado: nuevoEstado }).eq("id", t.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchData();
  };

  const nombreAsignado = (id: string | null) => {
    if (!id) return null;
    return trabajadores.find(t => t.id === id)?.full_name ?? null;
  };

  const FormBody = () => (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Tarea *</Label>
        <Textarea value={fNombre} onChange={e => setFNombre(e.target.value)} rows={2}
          className="border rounded-md bg-transparent text-sm focus-visible:ring-0 resize-none"
          style={{ color: "hsl(0 0% 90%)", borderColor: "hsl(0 0% 22%)" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Estado</Label>
          <Select value={fEstado} onValueChange={setFEstado}>
            <SelectTrigger className="border-0 border-b rounded-none bg-transparent focus:ring-0 px-0 h-9"
              style={{ borderColor: "hsl(0 0% 25%)", color: "hsl(0 0% 90%)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_TAREA.map(e => <SelectItem key={e} value={e}>{estadoLabel[e]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Prioridad</Label>
          <Select value={fPrioridad} onValueChange={setFPrioridad}>
            <SelectTrigger className="border-0 border-b rounded-none bg-transparent focus:ring-0 px-0 h-9"
              style={{ borderColor: "hsl(0 0% 25%)", color: "hsl(0 0% 90%)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sin_prioridad">Sin prioridad</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Fecha límite</Label>
          <Input type="date" value={fFecha} onChange={e => setFFecha(e.target.value)}
            className="border-0 border-b rounded-none bg-transparent text-sm focus-visible:ring-0 focus-visible:border-b-2 px-0"
            style={{ color: "hsl(0 0% 90%)", borderColor: "hsl(0 0% 25%)" }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Asignar a</Label>
          <Select value={fAsignado} onValueChange={setFAsignado}>
            <SelectTrigger className="border-0 border-b rounded-none bg-transparent focus:ring-0 px-0 h-9"
              style={{ borderColor: "hsl(0 0% 25%)", color: "hsl(0 0% 90%)" }}>
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sin_asignar">Sin asignar</SelectItem>
              {trabajadores.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Notas</Label>
        <Textarea value={fNotas} onChange={e => setFNotas(e.target.value)} rows={2}
          className="border rounded-md bg-transparent text-sm focus-visible:ring-0 resize-none"
          style={{ color: "hsl(0 0% 90%)", borderColor: "hsl(0 0% 22%)" }} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>URL Notion</Label>
        <Input value={fNotion} onChange={e => setFNotion(e.target.value)} placeholder="https://notion.so/..."
          className="border-0 border-b rounded-none bg-transparent text-sm focus-visible:ring-0 focus-visible:border-b-2 px-0"
          style={{ color: "hsl(0 0% 90%)", borderColor: "hsl(0 0% 25%)" }} />
      </div>
      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 text-xs tracking-[0.2em] uppercase font-medium rounded-lg transition-all disabled:opacity-50 mt-2"
        style={{ backgroundColor: "hsl(142 45% 30%)", color: "hsl(0 0% 96%)", border: "1px solid hsl(142 40% 38%)" }}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Guardar"}
      </button>
    </div>
  );

  const pendienteCount = tareas.filter(t => t.estado !== "completada").length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" style={{ color: "hsl(142 55% 50%)" }} />
          <h1 className="text-lg font-medium tracking-wide" style={{ color: "hsl(0 0% 92%)" }}>Tareas</h1>
          {pendienteCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "hsl(38 90% 45% / 0.2)", color: "hsl(38 90% 60%)" }}>
              {pendienteCount}
            </span>
          )}
        </div>
        {isStaff && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs tracking-wide uppercase font-medium"
            style={{ backgroundColor: "hsl(142 45% 28%)", color: "hsl(0 0% 92%)", border: "1px solid hsl(142 40% 36%)" }}>
            <Plus className="h-3.5 w-3.5" /> Nueva
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { key: "activas", label: "Activas" },
          { key: "pendiente", label: "Pendiente" },
          { key: "en_progreso", label: "En progreso" },
          { key: "delegada", label: "Delegadas" },
          { key: "completadas", label: "Hechas" },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className="flex-none px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor: filtro === f.key ? "hsl(142 45% 28%)" : "hsl(150 15% 16%)",
              color: filtro === f.key ? "hsl(0 0% 96%)" : "hsl(0 0% 50%)",
              border: `1px solid ${filtro === f.key ? "hsl(142 40% 36%)" : "hsl(150 10% 22%)"}`,
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "hsl(142 55% 50%)" }} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: "hsl(0 0% 40%)" }}>No hay tareas</p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(t => {
            const col = estadoColor[t.estado] ?? estadoColor.pendiente;
            const asig = nombreAsignado(t.asignado_a);
            const esCompletada = t.estado === "completada";
            return (
              <Card key={t.id} className="border-0" style={{ backgroundColor: "hsl(150 18% 15%)", opacity: esCompletada ? 0.65 : 1 }}>
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug"
                        style={{ color: "hsl(0 0% 90%)", textDecoration: esCompletada ? "line-through" : "none" }}>
                        {t.nombre}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: col.bg, color: col.text }}>
                          {estadoLabel[t.estado]}
                        </span>
                        {t.prioridad && (
                          <span className="text-[10px] font-medium uppercase tracking-wide"
                            style={{ color: prioridadColor[t.prioridad] }}>
                            ↑ {t.prioridad}
                          </span>
                        )}
                        {t.fecha_limite && (
                          <span className="text-[10px]" style={{ color: "hsl(0 0% 45%)" }}>
                            {new Date(t.fecha_limite).toLocaleDateString("es-ES")}
                          </span>
                        )}
                        {asig && (
                          <span className="flex items-center gap-1 text-[10px]"
                            style={{ color: "hsl(142 55% 50%)" }}>
                            <UserCheck className="h-3 w-3" />{asig.split(" ")[0]}
                          </span>
                        )}
                      </div>
                      {t.notas && (
                        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "hsl(0 0% 40%)" }}>{t.notas}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.notion_url && (
                        <a href={t.notion_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg" style={{ color: "hsl(0 0% 38%)" }}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {isStaff ? (
                        <>
                          <button onClick={() => openEdit(t)}
                            className="p-1.5 rounded-lg" style={{ color: "hsl(0 0% 38%)" }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(t)}
                            className="p-1.5 rounded-lg" style={{ color: "hsl(0 72% 50% / 0.6)" }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleMarcarHecha(t)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: esCompletada ? "hsl(142 55% 50%)" : "hsl(0 0% 38%)" }}>
                          <CheckSquare className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={o => { if (!o) setEditTarget(null); }}>
        <DialogContent style={{ backgroundColor: "hsl(150 22% 13%)", border: "1px solid hsl(150 10% 22%)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "hsl(0 0% 92%)" }}>Editar tarea</DialogTitle>
          </DialogHeader>
          <FormBody />
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent style={{ backgroundColor: "hsl(150 22% 13%)", border: "1px solid hsl(150 10% 22%)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "hsl(0 0% 92%)" }}>Nueva tarea</DialogTitle>
          </DialogHeader>
          <FormBody />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent style={{ backgroundColor: "hsl(150 22% 13%)", border: "1px solid hsl(150 10% 22%)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "hsl(0 0% 92%)" }}>Eliminar tarea</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "hsl(0 0% 50%)" }}>
              ¿Seguro que quieres eliminar "{deleteTarget?.nombre}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ backgroundColor: "hsl(150 15% 20%)", color: "hsl(0 0% 70%)", border: "none" }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}
              style={{ backgroundColor: "hsl(0 60% 35%)", color: "hsl(0 0% 96%)" }}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
