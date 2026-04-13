import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Plus, Loader2, ExternalLink, Pencil, Trash2, Camera, X, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Presupuesto {
  id: string;
  nombre: string;
  cliente: string | null;
  estado: string;
  fecha_envio: string | null;
  importe: number | null;
  notas: string | null;
  notion_url: string | null;
}

const ESTADOS = ["Pendiente de enviar", "Pendiente de respuesta", "Aceptado", "Rechazado"];

const SUPABASE_URL = "https://imngbfxhtkjntavwzwuv.supabase.co";

const columnStyle: Record<string, { header: string; dot: string }> = {
  "Pendiente de enviar":    { header: "hsl(38 90% 60%)",  dot: "hsl(38 90% 55%)" },
  "Pendiente de respuesta": { header: "hsl(210 80% 65%)", dot: "hsl(210 80% 60%)" },
  "Aceptado":               { header: "hsl(142 55% 55%)", dot: "hsl(142 55% 50%)" },
  "Rechazado":              { header: "hsl(0 72% 60%)",   dot: "hsl(0 72% 55%)" },
};

const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/presupuestos/${path}`;
}

export default function Presupuestos() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Presupuesto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Presupuesto | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Images state for current edit/create
  const [images, setImages] = useState<string[]>([]); // storage paths
  const [uploadingImg, setUploadingImg] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null); // presupuesto id for uploads

  // Form state
  const [fNombre, setFNombre] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fEstado, setFEstado] = useState(ESTADOS[0]);
  const [fFecha, setFFecha] = useState("");
  const [fImporte, setFImporte] = useState("");
  const [fNotas, setFNotas] = useState("");
  const [fNotion, setFNotion] = useState("");

  const fetchData = async () => {
    const { data } = await supabase
      .from("presupuestos")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setItems(data as Presupuesto[]);
    setLoading(false);
  };

  const loadImages = async (id: string) => {
    const { data } = await supabase.storage.from("presupuestos").list(id);
    setImages(data ? data.map(f => `${id}/${f.name}`) : []);
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = async (p: Presupuesto) => {
    setEditTarget(p);
    setCurrentId(p.id);
    setFNombre(p.nombre);
    setFCliente(p.cliente ?? "");
    setFEstado(p.estado);
    setFFecha(p.fecha_envio ?? "");
    setFImporte(p.importe != null ? String(p.importe) : "");
    setFNotas(p.notas ?? "");
    setFNotion(p.notion_url ?? "");
    await loadImages(p.id);
  };

  const openCreate = () => {
    const newId = crypto.randomUUID();
    setCurrentId(newId);
    setFNombre(""); setFCliente(""); setFEstado(ESTADOS[0]);
    setFFecha(""); setFImporte(""); setFNotas(""); setFNotion("");
    setImages([]);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!fNombre.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Record<string, any> = {
      nombre: fNombre.trim(),
      cliente: fCliente.trim() || null,
      estado: fEstado,
      fecha_envio: fFecha || null,
      importe: fImporte ? parseFloat(fImporte) : null,
      notas: fNotas.trim() || null,
      notion_url: fNotion.trim() || null,
    };
    if (editTarget) {
      const { error } = await supabase.from("presupuestos").update(payload).eq("id", editTarget.id);
      if (error) toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
      else { toast({ title: "Presupuesto actualizado" }); setEditTarget(null); fetchData(); }
    } else {
      const { error } = await supabase.from("presupuestos").insert({ id: currentId!, ...payload });
      if (error) toast({ title: "Error al crear", description: error.message, variant: "destructive" });
      else { toast({ title: "Presupuesto creado" }); setShowCreate(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Delete storage folder
    const { data: files } = await supabase.storage.from("presupuestos").list(deleteTarget.id);
    if (files && files.length > 0) {
      await supabase.storage.from("presupuestos").remove(files.map(f => `${deleteTarget.id}/${f.name}`));
    }
    const { error } = await supabase.from("presupuestos").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    else { toast({ title: "Presupuesto eliminado" }); setDeleteTarget(null); fetchData(); }
    setDeleting(false);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentId) return;
    setUploadingImg(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${currentId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("presupuestos").upload(path, file, { contentType: file.type });
    if (error) {
      toast({ title: "Error al subir imagen", description: "Verifica permisos de almacenamiento en el panel de Supabase.", variant: "destructive" });
    } else {
      setImages(prev => [...prev, path]);
    }
    setUploadingImg(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteImage = async (path: string) => {
    await supabase.storage.from("presupuestos").remove([path]);
    setImages(prev => prev.filter(p => p !== path));
  };

  const FormBody = () => (
    <div className="space-y-4 pt-2 overflow-y-auto max-h-[70vh]">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Nombre *</Label>
        <Input value={fNombre} onChange={e => setFNombre(e.target.value)}
          className="border-0 border-b rounded-none bg-transparent text-sm focus-visible:ring-0 focus-visible:border-b-2 px-0"
          style={{ color: "hsl(0 0% 90%)", borderColor: "hsl(0 0% 25%)" }} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Cliente</Label>
        <Input value={fCliente} onChange={e => setFCliente(e.target.value)}
          className="border-0 border-b rounded-none bg-transparent text-sm focus-visible:ring-0 focus-visible:border-b-2 px-0"
          style={{ color: "hsl(0 0% 90%)", borderColor: "hsl(0 0% 25%)" }} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Estado</Label>
        <Select value={fEstado} onValueChange={setFEstado}>
          <SelectTrigger className="border-0 border-b rounded-none bg-transparent focus:ring-0 px-0"
            style={{ borderColor: "hsl(0 0% 25%)", color: "hsl(0 0% 90%)" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Fecha envío</Label>
          <Input type="date" value={fFecha} onChange={e => setFFecha(e.target.value)}
            className="border-0 border-b rounded-none bg-transparent text-sm focus-visible:ring-0 focus-visible:border-b-2 px-0"
            style={{ color: "hsl(0 0% 90%)", borderColor: "hsl(0 0% 25%)" }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Importe (€)</Label>
          <Input type="number" min="0" step="0.01" value={fImporte} onChange={e => setFImporte(e.target.value)}
            className="border-0 border-b rounded-none bg-transparent text-sm focus-visible:ring-0 focus-visible:border-b-2 px-0"
            style={{ color: "hsl(0 0% 90%)", borderColor: "hsl(0 0% 25%)" }} />
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

      {/* Photos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-widest" style={{ color: "hsl(0 0% 55%)" }}>Fotos</Label>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImg}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ backgroundColor: "hsl(150 15% 20%)", color: "hsl(142 55% 55%)", border: "1px solid hsl(150 10% 28%)" }}>
            {uploadingImg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            Añadir foto
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
        </div>
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map(path => (
              <div key={path} className="relative group w-20 h-20 rounded-lg overflow-hidden"
                style={{ border: "1px solid hsl(150 10% 25%)" }}>
                <img src={publicUrl(path)} alt="" className="w-full h-full object-cover" />
                <button onClick={() => handleDeleteImage(path)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: "hsl(0 60% 35%)" }}>
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 text-xs tracking-[0.2em] uppercase font-medium rounded-lg transition-all disabled:opacity-50 mt-2"
        style={{ backgroundColor: "hsl(142 45% 30%)", color: "hsl(0 0% 96%)", border: "1px solid hsl(142 40% 38%)" }}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Guardar"}
      </button>
    </div>
  );

  // Group by estado
  const byEstado = ESTADOS.reduce((acc, e) => {
    acc[e] = items.filter(p => p.estado === e);
    return acc;
  }, {} as Record<string, Presupuesto[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" style={{ color: "hsl(142 55% 50%)" }} />
          <h1 className="text-lg font-medium tracking-wide" style={{ color: "hsl(0 0% 92%)" }}>Presupuestos</h1>
          <span className="text-xs" style={{ color: "hsl(0 0% 45%)" }}>{items.length}</span>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs tracking-wide uppercase font-medium"
          style={{ backgroundColor: "hsl(142 45% 28%)", color: "hsl(0 0% 92%)", border: "1px solid hsl(142 40% 36%)" }}>
          <Plus className="h-3.5 w-3.5" /> Nuevo
        </button>
      </div>

      {/* Kanban board — horizontal scroll */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "hsl(142 55% 50%)" }} />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto scrollbar-hide px-4 pb-4"
          style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="flex gap-3 h-full" style={{ width: `${ESTADOS.length * 280}px` }}>
            {ESTADOS.map(estado => {
              const col = columnStyle[estado];
              const cards = byEstado[estado] ?? [];
              return (
                <div key={estado} className="flex flex-col rounded-xl overflow-hidden"
                  style={{ width: 272, flexShrink: 0, backgroundColor: "hsl(150 16% 13%)" }}>
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-3 py-2.5"
                    style={{ borderBottom: `2px solid ${col.dot}` }}>
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: col.dot }} />
                    <span className="text-xs font-medium tracking-wide uppercase" style={{ color: col.header }}>
                      {estado}
                    </span>
                    <span className="ml-auto text-xs" style={{ color: "hsl(0 0% 40%)" }}>{cards.length}</span>
                  </div>
                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {cards.length === 0 && (
                      <p className="text-center text-xs py-6" style={{ color: "hsl(0 0% 30%)" }}>—</p>
                    )}
                    {cards.map(p => (
                      <div key={p.id} className="rounded-lg p-3 group"
                        style={{ backgroundColor: "hsl(150 18% 17%)", border: "1px solid hsl(150 10% 22%)" }}>
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug" style={{ color: "hsl(0 0% 90%)" }}>
                              {p.nombre}
                            </p>
                            {p.cliente && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: "hsl(0 0% 48%)" }}>{p.cliente}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {p.importe != null && (
                                <span className="text-xs font-semibold" style={{ color: "hsl(142 55% 55%)" }}>
                                  {fmt.format(p.importe)}
                                </span>
                              )}
                              {p.fecha_envio && (
                                <span className="text-[10px]" style={{ color: "hsl(0 0% 40%)" }}>
                                  {new Date(p.fecha_envio).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
                                </span>
                              )}
                            </div>
                            {p.notas && (
                              <p className="text-xs mt-1.5 leading-relaxed line-clamp-2" style={{ color: "hsl(0 0% 40%)" }}>
                                {p.notas}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                            {p.notion_url && (
                              <a href={p.notion_url} target="_blank" rel="noopener noreferrer"
                                className="p-1 rounded" style={{ color: "hsl(0 0% 45%)" }}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button onClick={() => openEdit(p)} className="p-1 rounded" style={{ color: "hsl(0 0% 45%)" }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(p)} className="p-1 rounded" style={{ color: "hsl(0 72% 50% / 0.7)" }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={o => { if (!o) setEditTarget(null); }}>
        <DialogContent style={{ backgroundColor: "hsl(150 22% 13%)", border: "1px solid hsl(150 10% 22%)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "hsl(0 0% 92%)" }}>Editar presupuesto</DialogTitle>
          </DialogHeader>
          <FormBody />
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent style={{ backgroundColor: "hsl(150 22% 13%)", border: "1px solid hsl(150 10% 22%)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "hsl(0 0% 92%)" }}>Nuevo presupuesto</DialogTitle>
          </DialogHeader>
          <FormBody />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent style={{ backgroundColor: "hsl(150 22% 13%)", border: "1px solid hsl(150 10% 22%)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "hsl(0 0% 92%)" }}>Eliminar presupuesto</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "hsl(0 0% 50%)" }}>
              ¿Eliminar "{deleteTarget?.nombre}"? Se borrarán también las fotos asociadas. Esta acción no se puede deshacer.
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
