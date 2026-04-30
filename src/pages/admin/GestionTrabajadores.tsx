import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Loader2, Plus, Trash2, Pencil, KeyRound, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Trabajador {
  id: string;
  full_name: string;
  email: string;
  role: string | null;
  pin: string | null;
}

const roleLabels: Record<string, string> = {
  dueno: "Dueño",
  admin: "Admin",
  encargado: "Encargado",
  jardinero: "Jardinero",
};

const roleColors: Record<string, string> = {
  dueno: "bg-[hsl(var(--green-deep)/0.12)] text-[hsl(var(--green-deep))]",
  admin: "bg-primary/10 text-primary",
  encargado: "bg-accent/15 text-accent",
  jardinero: "bg-[hsl(var(--urgencia-baja)/0.12)] text-[hsl(var(--urgencia-baja))]",
};

export default function GestionTrabajadores() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trabajador | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<Trabajador | null>(null);
  const [editing, setEditing] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // PIN management
  const [pinTarget, setPinTarget] = useState<Trabajador | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [removingPin, setRemovingPin] = useState<string | null>(null);

  // Form state
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("jardinero");
  const [pinCreate, setPinCreate] = useState("");

  const fetchTrabajadores = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, pin"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profilesRes.data) {
      const rolesMap: Record<string, string> = {};
      (rolesRes.data ?? []).forEach(r => { rolesMap[r.user_id] = r.role; });
      const mapped = profilesRes.data.map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        pin: p.pin,
        role: rolesMap[p.id] ?? null,
      }));
      setTrabajadores(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTrabajadores(); }, []);

  const handleCreate = async () => {
    if (!nombre.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    // For non-jardinero roles, email and password are required
    if (rol !== "jardinero" && (!email.trim() || !password.trim())) {
      toast({ title: "Email y contraseña son obligatorios para este rol", variant: "destructive" });
      return;
    }
    // For jardineros, PIN is required (it's their login method)
    if (rol === "jardinero" && !/^\d{4,6}$/.test(pinCreate)) {
      toast({ title: "El PIN es obligatorio para jardineros (4-6 dígitos)", variant: "destructive" });
      return;
    }
    if (pinCreate && !/^\d{4,6}$/.test(pinCreate)) {
      toast({ title: "El PIN debe tener entre 4 y 6 dígitos", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-worker", {
        body: {
          action: "create",
          email: email || undefined,
          password: password || undefined,
          full_name: nombre,
          role: rol,
          pin: pinCreate || undefined,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Trabajador creado correctamente" });
      setShowCreate(false);
      setNombre(""); setEmail(""); setPassword(""); setRol("jardinero"); setPinCreate("");
      await fetchTrabajadores();
    } catch (e: unknown) {
      toast({ title: "Error al crear", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleChangeRole = async (t: Trabajador, newRole: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-worker", {
        body: { action: "update_role", user_id: t.id, role: newRole },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: `Rol de ${t.full_name} cambiado a ${roleLabels[newRole]}` });
      await fetchTrabajadores();
    } catch (e: unknown) {
      toast({ title: "Error al cambiar rol", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const openEdit = (t: Trabajador) => {
    setEditTarget(t);
    setEditNombre(t.full_name);
    setEditEmail(t.email);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!editNombre.trim() || !editEmail.trim()) {
      toast({ title: "Nombre y email son obligatorios", variant: "destructive" });
      return;
    }
    setEditing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-worker", {
        body: { action: "update_profile", user_id: editTarget.id, full_name: editNombre.trim(), email: editEmail.trim() },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Datos actualizados" });
      setEditTarget(null);
      await fetchTrabajadores();
    } catch (e: unknown) {
      toast({ title: "Error al actualizar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-worker", {
        body: { action: "delete", user_id: deleteTarget.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Trabajador eliminado" });
      setDeleteTarget(null);
      await fetchTrabajadores();
    } catch (e: unknown) {
      toast({ title: "Error al eliminar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleSavePin = async () => {
    if (!pinTarget) return;
    if (!/^\d{4,6}$/.test(pinValue)) {
      toast({ title: "El PIN debe tener entre 4 y 6 dígitos", variant: "destructive" });
      return;
    }
    setSavingPin(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-worker", {
        body: { action: "update_pin", user_id: pinTarget.id, pin: pinValue },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: `PIN asignado a ${pinTarget.full_name}` });
      setPinTarget(null);
      setPinValue("");
      await fetchTrabajadores();
    } catch (e: unknown) {
      toast({ title: "Error al asignar PIN", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSavingPin(false);
    }
  };

  const handleRemovePin = async (t: Trabajador) => {
    setRemovingPin(t.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-worker", {
        body: { action: "update_pin", user_id: t.id, pin: null },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: `PIN eliminado de ${t.full_name}` });
      await fetchTrabajadores();
    } catch (e: unknown) {
      toast({ title: "Error al eliminar PIN", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setRemovingPin(null);
    }
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
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Trabajadores</h1>
          <span className="text-sm text-muted-foreground ml-1">({trabajadores.length})</span>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Añadir
          </Button>
        )}
      </div>

      {trabajadores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay trabajadores registrados todavía.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trabajadores.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 w-10 h-10 flex items-center justify-center shrink-0">
                    <span className="font-bold text-primary text-sm">
                      {t.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{t.full_name}</p>
                        {!t.email.includes("@interno.landscapers.local") && (
                          <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setPinTarget(t); setPinValue(t.pin ?? ""); }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Gestionar PIN"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(t)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Editar trabajador"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(t)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Eliminar trabajador"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {isAdmin ? (
                        <Select
                          value={t.role ?? ""}
                          onValueChange={(newRole) => handleChangeRole(t, newRole)}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="jardinero">Jardinero</SelectItem>
                            <SelectItem value="encargado">Encargado</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : t.role ? (
                        <Badge className={`border-0 text-xs ${roleColors[t.role] ?? ""}`}>
                          {roleLabels[t.role] ?? t.role}
                        </Badge>
                      ) : null}
                      {t.pin && (
                        <Badge variant="outline" className="text-xs gap-1 font-mono">
                          <KeyRound className="h-3 w-3" />
                          PIN: {t.pin}
                          {isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemovePin(t); }}
                              disabled={removingPin === t.id}
                              className="ml-1 hover:text-destructive transition-colors"
                            >
                              {removingPin === t.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: Crear trabajador */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo trabajador</DialogTitle>
            <DialogDescription>Crea una cuenta para un nuevo miembro del equipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={rol} onValueChange={setRol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jardinero">Jardinero</SelectItem>
                  <SelectItem value="encargado">Encargado</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan García" />
            </div>
            {rol === "jardinero" ? (
              <div className="space-y-2">
                <Label htmlFor="pinCreate">PIN de acceso</Label>
                <Input
                  id="pinCreate"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinCreate}
                  onChange={(e) => setPinCreate(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="4-6 dígitos"
                  className="font-mono text-xl tracking-[0.4em] text-center h-12"
                />
                <p className="text-xs text-muted-foreground">El jardinero usará este PIN para entrar. No necesita email.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@ejemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pinCreate">PIN de acceso rápido <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="pinCreate"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pinCreate}
                    onChange={(e) => setPinCreate(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="4-6 dígitos"
                    className="font-mono tracking-widest"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmar eliminación */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {deleteTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará su cuenta y todos sus datos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Editar trabajador */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar trabajador</DialogTitle>
            <DialogDescription>Modifica el nombre o email del trabajador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editNombre">Nombre completo</Label>
              <Input id="editNombre" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input id="editEmail" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleEditSave} disabled={editing}>
              {editing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gestionar PIN */}
      <Dialog open={!!pinTarget} onOpenChange={(open) => { if (!open) { setPinTarget(null); setPinValue(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              PIN de {pinTarget?.full_name}
            </DialogTitle>
            <DialogDescription>
              {pinTarget?.pin
                ? "Este trabajador ya tiene un PIN asignado. Puedes cambiarlo o eliminarlo."
                : "Asigna un PIN numérico de 4-6 dígitos para acceso rápido sin email."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pinInput">PIN</Label>
              <Input
                id="pinInput"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Ej: 1234"
                className="font-mono text-2xl tracking-[0.5em] text-center h-14"
              />
              <p className="text-xs text-muted-foreground text-center">4-6 dígitos numéricos</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {pinTarget?.pin && (
              <Button
                variant="destructive"
                onClick={() => { handleRemovePin(pinTarget); setPinTarget(null); setPinValue(""); }}
                className="w-full sm:w-auto"
              >
                Quitar PIN
              </Button>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              <DialogClose asChild>
                <Button variant="outline" className="flex-1">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleSavePin} disabled={savingPin || pinValue.length < 4} className="flex-1">
                {savingPin && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}