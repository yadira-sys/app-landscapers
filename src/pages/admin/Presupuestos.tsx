import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { FileText, Plus, Loader2, ExternalLink, Pencil } from "lucide-react";
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

const estadoColor: Record<string, { bg: string; text: string }> = {
  "Pendiente de enviar": { bg: "hsl(38 90% 45% / 0.15)", text: "hsl(38 90% 60%)" },
  "Pendiente de respuesta": { bg: "hsl(210 80% 50% / 0.15)", text: "hsl(210 80% 65%)" },
  "Aceptado": { bg: "hsl(142 55% 40% / 0.2)", text: "hsl(142 55% 55%)" },
  "Rechazado": { bg: "hsl(0 72% 50% / 0.15)", text: "hsl(0 72% 65%)" },
};

const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export default function Presupuestos() {
  const { toast } = useToast();
  const [items, setItems] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [editTarget, setEditTarget] = useState<Presupuesto | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => { fetchData(); }, []);

  const filtered = filtro === "todos" ? items : items.filter(p => p.estado === filtro);

  const openEdit = (p: Presupuesto) => {
    setEditTarget(p);
    setFNombre(p.nombre);
    setFCliente(p.cliente ?? "");
    setFEstado(p.estado);
    setFFecha(p.fecha_envio ?? "");
    setFImporte(p.importe != null ? String(p.importe) : "");
    setFNotas(p.notas ?? "");
    setFNotion(p.notion_url ?? "");
  };

  const openCreate = () => {
    setFNombre(""); setFCliente(""); setFEstado(ESTADOS[0]);
    setFFecha(""); setFImporte(""); setFNotas(""); setFNotion("");
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
      const { error } = await supabase.from("presupuestos").insert(payload);
      if (error) toast({ title: "Error al crear", description: error.message, variant: "destructive" });
      else { toast({ title: "Presupuesto creado" }); setShowCreate(false); fetchData(); }
    }
    setSaving(false);
  };

  const FormBody = () => (
    <div className="space-y-4 pt-2">
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
          <SelectTrigger className="border-0 border-b rounded-none bg-transparent focus:ring-0 px-0" style={{ borderColor: "hsl(0 0% 25%)", color: "hsl(0 0% 90%)" }}>
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
        <Textarea value={fNotas} onChange={e => setFNotas(e.target.value)} rows={3}
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

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" style={{ color: "hsl(142 55% 50%)" }} />
          <h1 className="text-lg font-medium tracking-wide" style={{ color: "hsl(0 0% 92%)" }}>Presupuestos</h1>
          <span className="text-xs ml-1" style={{ color: "hsl(0 0% 45%)" }}>{items.length}</span>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs tracking-wide uppercase font-medium"
          style={{ backgroundColor: "hsl(142 45% 28%)", color: "hsl(0 0% 92%)", border: "1px solid hsl(142 40% 36%)" }}>
          <Plus className="h-3.5 w-3.5" /> Nuevo
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {["todos", ...ESTADOS].map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            className="flex-none px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor: filtro === e ? "hsl(142 45% 28%)" : "hsl(150 15% 16%)",
              color: filtro === e ? "hsl(0 0% 96%)" : "hsl(0 0% 50%)",
              border: `1px solid ${filtro === e ? "hsl(142 40% 36%)" : "hsl(150 10% 22%)"}`,
            }}>
            {e === "todos" ? "Todos" : e}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "hsl(142 55% 50%)" }} /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: "hsl(0 0% 40%)" }}>No hay presupuestos</p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(p => {
            const col = estadoColor[p.estado] ?? { bg: "hsl(0 0% 20%)", text: "hsl(0 0% 55%)" };
            return (
              <Card key={p.id} className="border-0" style={{ backgroundColor: "hsl(150 18% 15%)" }}>
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug truncate" style={{ color: "hsl(0 0% 90%)" }}>{p.nombre}</p>
                      {p.cliente && (
                        <p className="text-xs mt-0.5" style={{ color: "hsl(0 0% 50%)" }}>{p.cliente}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: col.bg, color: col.text }}>
                          {p.estado}
                        </span>
                        {p.fecha_envio && (
                          <span className="text-[10px]" style={{ color: "hsl(0 0% 45%)" }}>
                            Enviado {new Date(p.fecha_envio).toLocaleDateString("es-ES")}
                          </span>
                        )}
                        {p.importe != null && (
                          <span className="text-[10px] font-medium" style={{ color: "hsl(142 55% 55%)" }}>
                            {fmt.format(p.importe)}
                          </span>
                        )}
                      </div>
                      {p.notas && (
                        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "hsl(0 0% 45%)" }}>{p.notas}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.notion_url && (
                        <a href={p.notion_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "hsl(0 0% 40%)" }}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "hsl(0 0% 40%)" }}>
                        <Pencil className="h-4 w-4" />
                      </button>
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
    </div>
  );
}
