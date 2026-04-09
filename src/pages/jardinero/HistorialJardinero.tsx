import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Loader2, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Jornada {
  id: string;
  entrada_at: string;
  salida_at: string | null;
  duracion_minutos: number | null;
  jardines: { nombre: string } | null;
}

export default function HistorialJardinero() {
  const { user } = useAuth();
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("jornadas")
      .select("id, entrada_at, salida_at, duracion_minutos, jardines(nombre)")
      .eq("jardinero_id", user.id)
      .order("entrada_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setJornadas(data as unknown as Jornada[]);
        setLoading(false);
      });
  }, [user]);

  const formatDuracion = (min: number | null) => {
    if (!min) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pt-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Mi Historial</h1>
      </div>

      {jornadas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay jornadas registradas todavía.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jornadas.map((j) => (
            <Card key={j.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold">{j.jardines?.nombre ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(j.entrada_at), "EEEE d MMM, HH:mm", { locale: es })}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="text-muted-foreground">Entrada: <span className="text-foreground font-medium">{format(new Date(j.entrada_at), "HH:mm")}</span></span>
                      {j.salida_at && (
                        <span className="text-muted-foreground">Salida: <span className="text-foreground font-medium">{format(new Date(j.salida_at), "HH:mm")}</span></span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {j.salida_at ? (
                      <Badge variant="secondary" className="font-mono">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuracion(j.duracion_minutos)}
                      </Badge>
                    ) : (
                      <Badge className="bg-[hsl(var(--urgencia-baja)/0.15)] text-[hsl(var(--urgencia-baja))] border-0">
                        En jornada
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
