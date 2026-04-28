import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns count of pending records (jornadas + trabajos_extras).
 * Cached for 5 min.
 */
export function usePendientesAlerta(enabled: boolean = true) {
  const { data = 0 } = useQuery({
    queryKey: ["alerta-pendientes"],
    queryFn: async () => {
      const [jornadasRes, extrasRes] = await Promise.all([
        supabase
          .from("jornadas")
          .select("id", { count: "exact", head: true })
          .eq("estado", "pendiente" as any)
          .not("hora_inicio", "is", null),
        supabase
          .from("trabajos_extras")
          .select("id", { count: "exact", head: true })
          .eq("estado", "pendiente" as any),
      ]);
      return (jornadasRes.count ?? 0) + (extrasRes.count ?? 0);
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  return data;
}
