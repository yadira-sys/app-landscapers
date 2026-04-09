import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface Compra {
  jardin_id: string;
  jardines: { nombre: string } | null;
  importe: number | null;
}

const COLORS = [
  "hsl(155 45% 40%)",
  "hsl(155 45% 55%)",
  "hsl(38 90% 50%)",
  "hsl(200 60% 50%)",
  "hsl(280 45% 50%)",
  "hsl(10 70% 55%)",
];

export default function ResumenGastos({ compras }: { compras: Compra[] }) {
  const { totalGastos, porJardin } = useMemo(() => {
    let total = 0;
    const jardinMap = new Map<string, { nombre: string; total: number }>();

    for (const c of compras) {
      if (c.importe != null) {
        total += c.importe;
        const nombre = c.jardines?.nombre ?? "Sin jardín";
        const existing = jardinMap.get(c.jardin_id);
        if (existing) {
          existing.total += c.importe;
        } else {
          jardinMap.set(c.jardin_id, { nombre, total: c.importe });
        }
      }
    }

    const sorted = Array.from(jardinMap.values()).sort((a, b) => b.total - a.total);
    return { totalGastos: total, porJardin: sorted };
  }, [compras]);

  if (totalGastos === 0) return null;

  return (
    <div
      className="rounded-sm border p-4 space-y-3"
      style={{ borderColor: "hsl(155 40% 70%)", backgroundColor: "hsl(155 40% 97%)" }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "hsl(155 40% 38%)" }}>
          Resumen de gastos
        </p>
        <p className="text-lg font-semibold" style={{ color: "hsl(155 45% 30%)" }}>
          {totalGastos.toFixed(2)} €
        </p>
      </div>

      {porJardin.length > 1 && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porJardin} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nombre"
                width={90}
                tick={{ fontSize: 10, fill: "hsl(30 5% 45%)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)} €`, "Total"]}
                contentStyle={{ fontSize: 12, borderRadius: 4 }}
              />
              <Bar dataKey="total" radius={[0, 3, 3, 0]} maxBarSize={20}>
                {porJardin.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {porJardin.length <= 1 && porJardin.length > 0 && (
        <p className="text-xs" style={{ color: "hsl(30 5% 50%)" }}>
          {porJardin[0].nombre}: {porJardin[0].total.toFixed(2)} €
        </p>
      )}
    </div>
  );
}
