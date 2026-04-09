import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { exportCsv } from "@/lib/exportCsv";

interface Jornada {
  id: string;
  entrada_at: string;
  salida_at: string | null;
  duracion_minutos: number | null;
  jardines: { nombre: string } | null;
  profiles: { full_name: string } | null;
}

export default function HistorialCompleto() {
  const { isAdmin } = useAuth();
  const [filtroJardin, setFiltroJardin] = useState("todos");

  const { data: jardines = [] } = useQuery({
    queryKey: ["jardines-activos", isAdmin],
    queryFn: async () => {
      let q = supabase.from("jardines").select("id, nombre").eq("activo", true);
      if (!isAdmin) q = q.eq("admin_only", false);
      const { data } = await q.order("nombre");
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: jornadas = [], isLoading: loading } = useQuery<Jornada[]>({
    queryKey: ["historial", filtroJardin],
    queryFn: async () => {
      let q = supabase
        .from("jornadas")
        .select("id, entrada_at, salida_at, duracion_minutos, jardines(nombre), profiles!jornadas_jardinero_id_profiles_fkey(full_name)")
        .order("entrada_at", { ascending: false })
        .limit(100);

      if (filtroJardin !== "todos") q = q.eq("jardin_id", filtroJardin);

      const { data } = await q;
      return (data ?? []) as unknown as Jornada[];
    },
  });

  const formatDuracion = (min: number | null) => {
    if (!min) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pt-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Historial</h1>
      </div>

      <div className="flex gap-2">
        <Select value={filtroJardin} onValueChange={setFiltroJardin}>
          <SelectTrigger className="h-9 text-xs flex-1">
            <SelectValue placeholder="Filtrar por jardín" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los jardines</SelectItem>
            {jardines.map((j) => (
              <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {jornadas.length > 0 && (
          <button
            onClick={() => {
              const headers = ["Trabajador", "Jardín", "Entrada", "Salida", "Duración"];
              const rows = jornadas.map((j) => [
                j.profiles?.full_name ?? "",
                j.jardines?.nombre ?? "",
                format(new Date(j.entrada_at), "dd/MM/yyyy HH:mm"),
                j.salida_at ? format(new Date(j.salida_at), "dd/MM/yyyy HH:mm") : "",
                formatDuracion(j.duracion_minutos),
              ]);
              exportCsv(`historial_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
            }}
            className="h-9 px-3 rounded-sm border flex items-center gap-1.5 text-xs shrink-0"
            style={{ borderColor: "hsl(30 10% 80%)", color: "hsl(30 5% 40%)" }}
            title="Exportar CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : jornadas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay jornadas registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jornadas.map((j) => (
            <Card key={j.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{j.profiles?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{j.jardines?.nombre ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(j.entrada_at), "EEEE d MMM, HH:mm", { locale: es })}
                      {j.salida_at && ` → ${format(new Date(j.salida_at), "HH:mm")}`}
                    </p>
                  </div>
                  {j.salida_at ? (
                    <Badge variant="secondary" className="font-mono text-xs shrink-0">
                      {formatDuracion(j.duracion_minutos)}
                    </Badge>
                  ) : (
                    <Badge className="bg-[hsl(var(--urgencia-baja)/0.15)] text-[hsl(var(--urgencia-baja))] border-0 text-xs shrink-0">
                      Activo
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
