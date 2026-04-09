import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HOLDED_INVOICING_API = "https://api.holded.com/api/invoicing/v1";
const HOLDED_PROJECTS_API = "https://api.holded.com/api/projects/v1";

// Cache project list to avoid repeated API calls
let cachedProjects: { id: string; name: string }[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HOLDED_API_KEY = Deno.env.get("HOLDED_API_KEY");
    if (!HOLDED_API_KEY) {
      console.warn("HOLDED_API_KEY not configured yet - skipping sync");
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: "HOLDED_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { type, data } = body;

    const holdedHeaders = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "key": HOLDED_API_KEY,
    };

    // Allow list_projects without auth (read-only) — force fresh fetch
    if (type === "list_projects") {
      cachedProjects = null; // clear cache
      const projects = await getProjects(holdedHeaders);
      return new Response(
        JSON.stringify({ success: true, projects, count: projects.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate the caller for all other operations
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: claims, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Holded project ID from jardines table mapping
    let projectId: string | null = null;
    if (data.jardin_id) {
      const { data: jardin } = await supabase
        .from("jardines")
        .select("holded_project_id")
        .eq("id", data.jardin_id)
        .maybeSingle();
      projectId = jardin?.holded_project_id ?? null;
    }
    // Fallback: try API match by name
    if (!projectId) {
      projectId = await findProjectByName(data.jardin_nombre, holdedHeaders);
    }

    // Resolve Holded user for time tracking (required by Holded API for horas/extras)
    let holdedUserId: string | null = null;
    if (type === "horas" || type === "extras") {
      holdedUserId = await findHoldedUserId(data.trabajador_nombre, holdedHeaders);
      if (!holdedUserId) {
        console.warn(`Holded sync - ${type}: no Holded user found for worker`, data.trabajador_nombre);
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason: `No Holded user found for ${data.trabajador_nombre}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let holdedResult: any = null;

    if (type === "horas") {
      holdedResult = await syncHoras(data, holdedHeaders, projectId, holdedUserId);
    } else if (type === "extras") {
      holdedResult = await syncExtras(data, holdedHeaders, projectId, holdedUserId);
    } else if (type === "gastos") {
      holdedResult = await syncGastos(data, holdedHeaders, projectId);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid type. Use: horas, extras, gastos, list_projects" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, holded: holdedResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-holded error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getProjects(headers: Record<string, string>): Promise<{ id: string; name: string }[]> {
  const now = Date.now();
  if (cachedProjects && (now - cacheTime) < CACHE_TTL) {
    return cachedProjects;
  }

  try {
    const url = `${HOLDED_PROJECTS_API}/projects`;
    console.log("Fetching Holded projects from:", url);
    const res = await fetch(url, {
      method: "GET",
      headers,
    });
    console.log("Holded projects response status:", res.status);
    const raw = await res.text();
    console.log("Holded projects raw response:", raw.substring(0, 2000));
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      cachedProjects = data.map((p: any) => ({ id: p.id, name: p.name }));
      cacheTime = now;
      return cachedProjects!;
    }
    console.log("Holded projects response is not an array:", typeof data, JSON.stringify(data).substring(0, 500));
  } catch (e) {
    console.error("Error fetching Holded projects:", e);
  }
  return [];
}

async function findProjectByName(gardenName: string | undefined, headers: Record<string, string>): Promise<string | null> {
  if (!gardenName) return null;

  const projects = await getProjects(headers);
  const normalized = gardenName.toLowerCase().trim();
  const exact = projects.find(p => p.name.toLowerCase().trim() === normalized);
  if (exact) return exact.id;

  const partial = projects.find(p =>
    p.name.toLowerCase().includes(normalized) || normalized.includes(p.name.toLowerCase())
  );
  return partial?.id ?? null;
}

async function findHoldedUserId(workerName: string | undefined, headers: Record<string, string>): Promise<string | null> {
  if (!workerName) return null;

  try {
    const res = await fetch("https://api.holded.com/api/team/v1/employees", {
      method: "GET",
      headers,
    });
    const raw = await res.text();
    const parsed = JSON.parse(raw);
    const employees = Array.isArray(parsed) ? parsed : (parsed.employees ?? []);
    const normalizedWorker = workerName.toLowerCase().trim();

    const exact = employees.find((emp: any) => {
      const fullName = `${emp.name ?? ""} ${emp.lastName ?? ""}`.toLowerCase().trim();
      return fullName === normalizedWorker || (emp.name ?? "").toLowerCase().trim() === normalizedWorker;
    });
    if (exact?.holdedUserId) return exact.holdedUserId;

    const fuzzy = employees.find((emp: any) => {
      const fullName = `${emp.name ?? ""} ${emp.lastName ?? ""}`.toLowerCase().trim();
      return fullName.includes(normalizedWorker) || normalizedWorker.includes((emp.name ?? "").toLowerCase().trim());
    });

    return fuzzy?.holdedUserId ?? null;
  } catch (e) {
    console.error("Error fetching Holded employees:", e);
    return null;
  }
}

async function syncHoras(data: any, headers: Record<string, string>, projectId: string | null, holdedUserId: string | null) {
  if (!projectId) {
    console.warn("Holded sync - horas: no project ID for garden:", data.jardin_nombre);
    return { skipped: true, reason: "No Holded project ID" };
  }
  if (!holdedUserId) {
    console.warn("Holded sync - horas: no Holded user ID for worker:", data.trabajador_nombre);
    return { skipped: true, reason: "No Holded user ID" };
  }

  const totalHours = data.total_horas ?? 0;
  const durationSeconds = Math.round(totalHours * 3600);

  const description = [
    `Jardín: ${data.jardin_nombre ?? "—"}`,
    `Trabajador: ${data.trabajador_nombre ?? "—"}`,
    `Horario: ${data.hora_inicio ?? ""} - ${data.hora_fin ?? ""}`,
    data.descripcion ? `Nota: ${data.descripcion}` : "",
  ].filter(Boolean).join(" | ");

  let dateTimestamp: number | undefined;
  if (data.fecha) {
    dateTimestamp = Math.floor(new Date(data.fecha + "T12:00:00").getTime() / 1000);
  }

  const payload: any = {
    duration: durationSeconds,
    desc: description,
    userId: holdedUserId,
  };
  if (dateTimestamp) {
    payload.date = dateTimestamp;
  }

  console.log("Holded sync - horas payload:", JSON.stringify(payload), "projectId:", projectId);

  const res = await fetch(`${HOLDED_PROJECTS_API}/projects/${projectId}/times`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  console.log("Holded sync - horas response status:", res.status, "body:", JSON.stringify(result));

  if (!res.ok) {
    console.error("Holded API error for horas:", res.status, JSON.stringify(result));
    return { error: true, status: res.status, details: result };
  }

  return result;
}

async function syncExtras(data: any, headers: Record<string, string>, projectId: string | null, holdedUserId: string | null) {
  if (!projectId) {
    console.warn("Holded sync - extras: no projects available in Holded");
    return { skipped: true, reason: "No Holded projects available" };
  }
  if (!holdedUserId) {
    console.warn("Holded sync - extras: no Holded user ID for worker:", data.trabajador_nombre);
    return { skipped: true, reason: "No Holded user ID" };
  }

  const tipoLabels: Record<string, string> = {
    reparacion_urgente: "Reparación urgente",
    material_adicional: "Material adicional",
    fuera_horario: "Fuera de horario",
    otro: "Otro",
  };

  const totalHours = data.horas ?? 0;
  const durationSeconds = Math.round(totalHours * 3600);

  const description = [
    `Jardín: ${data.jardin_nombre ?? "—"}`,
    `Trabajo extra: ${tipoLabels[data.tipo] ?? data.tipo}`,
    `Trabajador: ${data.trabajador_nombre ?? "—"}`,
    data.descripcion ? `Nota: ${data.descripcion}` : "",
  ].filter(Boolean).join(" | ");

  let dateTimestamp: number | undefined;
  if (data.fecha) {
    dateTimestamp = Math.floor(new Date(data.fecha + "T12:00:00").getTime() / 1000);
  }

  const payload: any = {
    duration: durationSeconds,
    desc: description,
    userId: holdedUserId,
  };
  if (dateTimestamp) {
    payload.date = dateTimestamp;
  }

  console.log("Holded sync - extras payload:", JSON.stringify(payload), "projectId:", projectId);

  const res = await fetch(`${HOLDED_PROJECTS_API}/projects/${projectId}/times`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  console.log("Holded sync - extras response status:", res.status, "body:", JSON.stringify(result));

  if (!res.ok) {
    console.error("Holded API error for extras:", res.status, JSON.stringify(result));
    return { error: true, status: res.status, details: result };
  }

  return result;
}

async function syncGastos(data: any, headers: Record<string, string>, projectId: string | null) {
  const tipoGastoLabels: Record<string, string> = {
    combustible: "Combustible",
    herramientas: "Herramientas",
    material: "Material",
    comida: "Comida",
    otro: "Otro",
  };

  const tipoLabel = tipoGastoLabels[data.tipo_gasto] ?? data.tipo_gasto;

  const payload: any = {
    contactName: data.trabajador_nombre ?? "Vitalia Garden",
    desc: `Gasto: ${tipoLabel} - ${data.jardin_nombre ?? "Jardín"}`,
    date: data.fecha ? Math.floor(new Date(data.fecha + "T12:00:00").getTime() / 1000) : Math.floor(Date.now() / 1000),
    approveDoc: false, // Borrador
    notes: [
      `Gasto de ${tipoLabel} - ${data.jardin_nombre ?? "Jardín"}`,
      data.trabajador_nombre ? `Registrado por: ${data.trabajador_nombre}` : "",
      data.fecha ? `Fecha: ${data.fecha}` : "",
      data.descripcion ?? "",
    ].filter(Boolean).join("\n"),
    items: [{
      name: `${tipoGastoLabels[data.tipo_gasto] ?? "Gasto"}: ${data.descripcion ?? ""}`,
      desc: `Jardín: ${data.jardin_nombre ?? "—"} | ${data.trabajador_nombre ?? ""}`,
      units: 1,
      subtotal: data.importe ?? 0,
    }],
  };

  if (projectId) {
    payload.tags = [data.jardin_nombre];
  }

  console.log("Holded sync - gastos payload:", JSON.stringify(payload));

  const res = await fetch(`${HOLDED_INVOICING_API}/documents/purchase`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  console.log("Holded sync - gastos response:", JSON.stringify(result));

  if (projectId && result?.id) {
    console.log("Holded: document created with tags for project association");
  }

  // Attach photo if available
  if (data.foto_factura_url && result?.id) {
    await attachPhotoToDocument(result.id, "purchase", data.foto_factura_url, headers);
  }

  return result;
}

async function attachPhotoToDocument(
  documentId: string,
  docType: string,
  photoUrl: string,
  headers: Record<string, string>
) {
  try {
    // Download the photo
    const photoRes = await fetch(photoUrl);
    if (!photoRes.ok) {
      console.error("Failed to download photo:", photoRes.status);
      return null;
    }
    const photoBlob = await photoRes.blob();
    const ext = photoUrl.split(".").pop()?.split("?")[0] ?? "jpg";
    const filename = `factura_${documentId}.${ext}`;

    // Upload to Holded as multipart
    const formData = new FormData();
    formData.append("file", photoBlob, filename);

    const uploadRes = await fetch(
      `${HOLDED_INVOICING_API}/documents/${docType}/${documentId}/attach`,
      {
        method: "POST",
        headers: { key: headers.key },
        body: formData,
      }
    );
    const uploadResult = await uploadRes.json();
    console.log("Holded attach photo result:", JSON.stringify(uploadResult));
    return uploadResult;
  } catch (e) {
    console.error("Error attaching photo to Holded document:", e);
    return null;
  }
}

