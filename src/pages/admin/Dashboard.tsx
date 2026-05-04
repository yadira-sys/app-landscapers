import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, TreePine, Clock, Loader2, ShoppingCart, Wrench, Download } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";

interface Stats {
  horasPendientes: number;
  extrasPendientes: number;
  gastosPendientes: number;
  totalJardines: number;
  totalTrabajadores: number;
  horasSemanales: number;
}

interface JardinResumen {
  id: string;
  nombre: string;
  totalHoras: number;
  totalGastos: number;
  extrasCount: number;
}

async function fetchDashboard() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [horasPend, extrasPend, gastosPend, jardRes, pRes, jornadasRes, comprasRes, extrasRes] = await Promise.all([
    supabase.from("jornadas").select("id", { count: "exact", head: true }).eq("estado", "pendiente").not("hora_inicio", "is", null),
    supabase.from("trabajos_extras").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("compras").select("id", { count: "exact", head: true }).eq("estado_cobro", "pendiente"),
    supabase.from("jardines").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("jornadas").select("jardin_id, total_horas, fecha").not("total_horas", "is", null).gte("fecha", weekAgo),
    supabase.from("compras").select("jardin_id, importe"),
    supabase.from("trabajos_extras").select("jardin_id"),
  ]);

  const jornadas = jornadasRes.data ?? [];
  const horasSemanales = jornadas.reduce((sum: number, j) => sum + (j.total_horas ?? 0), 0);

  const jardines = jardRes.data ?? [];
  const compras = comprasRes.data ?? [];
  const extras = extrasRes.data ?? [];

  const horasMap: Record<string, number> = {};
  jornadas.forEach(j => { horasMap[j.jardin_id] = (horasMap[j.jardin_id] ?? 0) + (j.total_horas ?? 0); });

  const gastosMap: Record<string, number> = {};
  compras.forEach(c => { gastosMap[c.jardin_id] = (gastosMap[c.jardin_id] ?? 0) + (c.importe ?? 0); });

  const extrasMap: Record<string, number> = {};
  extras.forEach(e => { extrasMap[e.jardin_id] = (extrasMap[e.jardin_id] ?? 0) + 1; });

  const stats: Stats = {
    horasPendientes: horasPend.count ?? 0,
    extrasPendientes: extrasPend.count ?? 0,
    gastosPendientes: gastosPend.count ?? 0,
    totalJardines: jardines.length,
    totalTrabajadores: pRes.count ?? 0,
    horasSemanales: Math.round(horasSemanales * 10) / 10,
  };

  const resumenJardines: JardinResumen[] = jardines.map(j => ({
    id: j.id,
    nombre: j.nombre,
    totalHoras: Math.round((horasMap[j.id] ?? 0) * 10) / 10,
    totalGastos: Math.round((gastosMap[j.id] ?? 0) * 100) / 100,
    extrasCount: extrasMap[j.id] ?? 0,
  }));

  return { stats, resumenJardines };
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  const stats = data?.stats ?? { horasPendientes: 0, extrasPendientes: 0, gastosPendientes: 0, totalJardines: 0, totalTrabajadores: 0, horasSemanales: 0 };
  const resumenJardines = data?.resumenJardines ?? [];

  const cards = [
    { label: "Horas pendientes", value: stats.horasPendientes, icon: Clock, accent: "hsl(38 90% 50%)" },
    { label: "Extras pendientes", value: stats.extrasPendientes, icon: Wrench, accent: "hsl(38 90% 50%)" },
    { label: "Gastos pendientes", value: stats.gastosPendientes, icon: ShoppingCart, accent: "hsl(38 90% 50%)" },
    { label: "Horas (7 días)", value: stats.horasSemanales + "h", icon: BarChart3, accent: "hsl(155 45% 45%)" },
    { label: "Jardines activos", value: stats.totalJardines, icon: TreePine, accent: "hsl(155 40% 50%)" },
    { label: "Trabajadores", value: stats.totalTrabajadores, icon: Users, accent: "hsl(42 60% 50%)" },
  ];

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(155 45% 45%)" }} />
    </div>
  );

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="font-display text-2xl font-light tracking-wide">Dashboard</h1>
          <div className="h-px w-12 mt-2" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
        </div>
        <button
          onClick={() => {
            const headers = ["Jardín", "Horas totales", "Gastos (€)", "Extras"];
            const rows = resumenJardines.map(j => [j.nombre, j.totalHoras.toString(), j.totalGastos.toFixed(2), j.extrasCount.toString()]);
            exportCsv(`dashboard_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium tracking-wide uppercase rounded-sm"
          style={{ borderColor: "hsl(30 10% 80%)", color: "hsl(30 5% 40%)", border: "1px solid hsl(30 10% 80%)" }}
        >
          <Download className="h-3.5 w-3.5" /> Exportar
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map(card => (
          <div key={card.label} className="rounded-sm p-4 border bg-card" style={{ borderColor: "hsl(30 10% 90%)" }}>
            <div className="mb-3"><card.icon className="h-5 w-5" style={{ color: card.accent }} /></div>
            <p className="text-3xl font-light font-display text-foreground">{card.value}</p>
            <p className="text-xs mt-1 font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Per-garden summary */}
      <div>
        <h2 className="font-display text-xl font-light tracking-wide mb-3">Resumen por jardín</h2>
        <div className="h-px w-10 mb-4" style={{ backgroundColor: "hsl(155 45% 45%)" }} />

        {resumenJardines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay jardines activos.</p>
        ) : (
          <div className="space-y-3">
            {resumenJardines.map(j => (
              <div key={j.id} className="rounded-sm border p-4 bg-card" style={{ borderColor: "hsl(30 10% 90%)" }}>
                <p className="font-semibold text-sm mb-3">{j.nombre}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1"><Clock className="h-3.5 w-3.5" style={{ color: "hsl(155 45% 45%)" }} /></div>
                    <p className="text-lg font-display font-light text-foreground">{j.totalHoras}h</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Horas</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1"><ShoppingCart className="h-3.5 w-3.5" style={{ color: "hsl(42 60% 50%)" }} /></div>
                    <p className="text-lg font-display font-light text-foreground">{j.totalGastos > 0 ? j.totalGastos.toFixed(0) + "€" : "0€"}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gastos</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1"><Wrench className="h-3.5 w-3.5" style={{ color: "hsl(45 65% 48%)" }} /></div>
                    <p className="text-lg font-display font-light text-foreground">{j.extrasCount}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Extras</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
