import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Clock, Wrench, ShoppingCart, Loader2, AlertCircle } from "lucide-react";
import QueryError from "@/components/QueryError";

interface HorasRecientes {
  id: string;
  fecha: string;
  total_horas: number | null;
  jardines: { nombre: string } | null;
  profiles: { full_name: string } | null;
}

export default function ResumenEncargado() {
  const { data, isLoading: loading, isError, refetch } = useQuery({
    queryKey: ["resumen-encargado"],
    queryFn: async () => {
      const [horasRes, extrasRes, gastosRes, recientesRes] = await Promise.all([
        supabase.from("jornadas").select("id", { count: "exact" }).eq("estado", "pendiente").not("hora_inicio", "is", null),
        supabase.from("trabajos_extras").select("id", { count: "exact" }).eq("estado", "pendiente"),
        supabase.from("compras").select("id", { count: "exact" }).eq("estado_cobro", "pendiente"),
        supabase
          .from("jornadas")
          .select("id, fecha, total_horas, jardines(nombre), profiles!jornadas_jardinero_id_profiles_fkey(full_name)")
          .eq("estado", "pendiente")
          .not("hora_inicio", "is", null)
          .order("fecha", { ascending: false })
          .limit(10),
      ]);
      if (recientesRes.error) throw recientesRes.error;
      return {
        counts: {
          horas: horasRes.count ?? 0,
          extras: extrasRes.count ?? 0,
          gastos: gastosRes.count ?? 0,
        },
        recientes: (recientesRes.data ?? []) as unknown as HorasRecientes[],
      };
    },
  });

  const counts = data?.counts ?? { horas: 0, extras: 0, gastos: 0 };
  const recientes = data?.recientes ?? [];

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(155 45% 45%)" }} />
    </div>
  );

  if (isError) return <QueryError onRetry={() => refetch()} />;

  const pendingCards = [
    { label: "Horas por aprobar", value: counts.horas, icon: Clock, accent: "hsl(38 90% 50%)" },
    { label: "Extras por aprobar", value: counts.extras, icon: Wrench, accent: "hsl(38 90% 50%)" },
    { label: "Gastos por aprobar", value: counts.gastos, icon: ShoppingCart, accent: "hsl(38 90% 50%)" },
  ];

  return (
    <div className="p-5 space-y-6">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-light tracking-wide">Resumen</h1>
        <div className="h-px w-12 mt-2" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
      </div>

      {/* Pending approvals */}
      <div className="grid grid-cols-3 gap-3">
        {pendingCards.map(card => (
          <div key={card.label} className="rounded-sm p-3 border bg-card text-center" style={{ borderColor: "hsl(30 10% 90%)" }}>
            <card.icon className="h-5 w-5 mx-auto mb-2" style={{ color: card.accent }} />
            <p className="text-2xl font-light font-display text-foreground">{card.value}</p>
            <p className="text-[9px] mt-1 font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Recent pending hours */}
      <div>
        <h2 className="font-display text-lg font-light tracking-wide mb-3">Horas pendientes recientes</h2>
        <div className="h-px w-10 mb-4" style={{ backgroundColor: "hsl(155 45% 45%)" }} />

        {recientes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No hay registros pendientes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recientes.map(r => (
              <div key={r.id} className="rounded-sm border p-3 bg-card flex items-center justify-between" style={{ borderColor: "hsl(30 10% 90%)" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.profiles?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.jardines?.nombre} · {r.fecha}</p>
                </div>
                <span className="text-sm font-semibold shrink-0 ml-3" style={{ color: "hsl(155 45% 30%)" }}>
                  {r.total_horas ?? 0}h
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
