import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns count of open incidents older than 48h.
 * Cached for 5 min to avoid repeated queries on navigation.
 */
export function useIncidenciasAlerta() {
  const { data = 0 } = useQuery({
    queryKey: ["alerta-incidencias"],
    queryFn: async () => {
      const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("incidencias")
        .select("id", { count: "exact", head: true })
        .in("estado", ["abierta", "en_proceso"])
        .lt("created_at", hace48h);
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  return data;
}
