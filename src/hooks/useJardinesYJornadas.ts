// Shared data hook for jardines + jornadas activas + companeros (per garden).
// Consumed by Fichaje.tsx (shared) and MisJardines.tsx (jardinero) — replaces ~80 LOC of duplicated fetch logic.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Jardin {
  id: string;
  nombre: string;
  direccion: string | null;
}

export interface JornadaActiva {
  id: string;
  jardin_id: string;
  entrada_at: string;
  jardinero_id: string;
  profiles?: { full_name: string } | null;
}

export interface Companero {
  nombre: string;
  entrada_at: string;
}

interface UseJardinesYJornadasOpts {
  esVisionGlobal: boolean;
  isAdmin: boolean;
  userId: string | undefined;
  enabled?: boolean;
}

interface UseJardinesYJornadasResult {
  jardines: Jardin[];
  jornadasActivas: JornadaActiva[];
  companerosMap: Map<string, Companero[]>;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface QueryData {
  jardines: Jardin[];
  jornadasActivas: JornadaActiva[];
  companerosMap: Map<string, Companero[]>;
}

async function fetchJardinesYJornadas(
  esVisionGlobal: boolean,
  isAdmin: boolean,
  userId: string,
): Promise<QueryData> {
  // ── 1. Jardines (scope depends on role) ──
  let jardinesPromise: Promise<Jardin[]>;
  if (esVisionGlobal) {
    let q = supabase.from("jardines").select("id, nombre, direccion").eq("activo", true);
    if (!isAdmin) q = q.eq("admin_only", false);
    jardinesPromise = q.order("nombre").then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as Jardin[];
    });
  } else {
    jardinesPromise = supabase
      .from("asignaciones")
      .select("jardin_id, jardines(id, nombre, direccion)")
      .eq("jardinero_id", userId)
      .eq("activo", true)
      .then(({ data, error }) => {
        if (error) throw error;
        return ((data ?? []) as any[])
          .map((a) => a.jardines)
          .filter(Boolean) as Jardin[];
      });
  }

  // ── 2. Jornadas activas (scope depends on role) ──
  let jornadasPromise: Promise<JornadaActiva[]>;
  if (esVisionGlobal) {
    jornadasPromise = supabase
      .from("jornadas")
      .select("id, jardin_id, entrada_at, jardinero_id")
      .is("salida_at", null)
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as JornadaActiva[];
      });
  } else {
    jornadasPromise = supabase
      .from("jornadas")
      .select("id, jardin_id, entrada_at, jardinero_id")
      .eq("jardinero_id", userId)
      .is("salida_at", null)
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as JornadaActiva[];
      });
  }

  const [jardines, jornadasActivas] = await Promise.all([jardinesPromise, jornadasPromise]);

  // ── 3. Profile lookup for active jornadas (supervisor view) ──
  if (esVisionGlobal && jornadasActivas.length > 0) {
    const jardineroIds = [...new Set(jornadasActivas.map((j) => j.jardinero_id))];
    const { data: perfiles, error: perfErr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", jardineroIds);
    if (perfErr) throw perfErr;
    const profilesMap = new Map(
      (perfiles ?? []).map((p: any) => [p.id, { full_name: p.full_name }]),
    );
    jornadasActivas.forEach((j) => {
      j.profiles = profilesMap.get(j.jardinero_id) ?? null;
    });
  }

  // ── 4. Companions in same gardens (jardinero view, today) ──
  const companerosMap = new Map<string, Companero[]>();
  if (!esVisionGlobal && jornadasActivas.length > 0) {
    const jardinIdsActivos = jornadasActivas.map((j) => j.jardin_id);
    const hoy = new Date().toISOString().split("T")[0];
    const { data: otras, error: otrasErr } = await supabase
      .from("jornadas")
      .select("jardin_id, jardinero_id, entrada_at")
      .in("jardin_id", jardinIdsActivos)
      .neq("jardinero_id", userId)
      .is("salida_at", null)
      .gte("entrada_at", `${hoy}T00:00:00`);
    if (otrasErr) throw otrasErr;
    if (otras && otras.length > 0) {
      const ids = [...new Set(otras.map((o: any) => o.jardinero_id))];
      const { data: perfs, error: perfErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      if (perfErr) throw perfErr;
      const perfMap = new Map((perfs ?? []).map((p: any) => [p.id, p.full_name]));
      for (const o of otras as any[]) {
        const list = companerosMap.get(o.jardin_id) ?? [];
        list.push({
          nombre: perfMap.get(o.jardinero_id) ?? "Compañero",
          entrada_at: o.entrada_at,
        });
        companerosMap.set(o.jardin_id, list);
      }
    }
  }

  return { jardines, jornadasActivas, companerosMap };
}

export function useJardinesYJornadas(opts: UseJardinesYJornadasOpts): UseJardinesYJornadasResult {
  const { esVisionGlobal, isAdmin, userId, enabled } = opts;

  const query = useQuery<QueryData, Error>({
    queryKey: ["jardines-y-jornadas", esVisionGlobal, isAdmin, userId],
    queryFn: () => fetchJardinesYJornadas(esVisionGlobal, isAdmin, userId!),
    enabled: enabled ?? !!userId,
  });

  return {
    jardines: query.data?.jardines ?? [],
    jornadasActivas: query.data?.jornadasActivas ?? [],
    companerosMap: query.data?.companerosMap ?? new Map(),
    loading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}
