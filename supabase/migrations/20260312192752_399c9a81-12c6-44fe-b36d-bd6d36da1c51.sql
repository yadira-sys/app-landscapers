
-- New enums
CREATE TYPE public.estado_registro AS ENUM ('pendiente', 'aprobado', 'rechazado');
CREATE TYPE public.tipo_trabajo_extra AS ENUM ('reparacion_urgente', 'material_adicional', 'fuera_horario', 'otro');
CREATE TYPE public.tipo_gasto AS ENUM ('combustible', 'herramientas', 'material', 'comida', 'otro');

-- Add columns to jornadas for manual hour registration
ALTER TABLE public.jornadas 
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS estado estado_registro NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS fecha date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fin time,
  ADD COLUMN IF NOT EXISTS total_horas numeric;

-- Add tipo_gasto to compras
ALTER TABLE public.compras 
  ADD COLUMN IF NOT EXISTS tipo_gasto tipo_gasto NOT NULL DEFAULT 'otro';

-- Create trabajos_extras table
CREATE TABLE IF NOT EXISTS public.trabajos_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jardin_id uuid NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo tipo_trabajo_extra NOT NULL DEFAULT 'otro',
  descripcion text NOT NULL,
  horas numeric,
  estado estado_registro NOT NULL DEFAULT 'pendiente',
  notas_revision text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trabajos_extras ENABLE ROW LEVEL SECURITY;

-- RLS for trabajos_extras
CREATE POLICY "Usuarios ven sus extras o superiores ven todos"
ON public.trabajos_extras FOR SELECT TO authenticated
USING (
  auth.uid() = usuario_id 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'dueno'::app_role) 
  OR has_role(auth.uid(), 'encargado'::app_role)
);

CREATE POLICY "Usuarios insertan sus extras"
ON public.trabajos_extras FOR INSERT TO authenticated
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Superiores actualizan extras"
ON public.trabajos_extras FOR UPDATE TO authenticated
USING (
  auth.uid() = usuario_id 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'dueno'::app_role) 
  OR has_role(auth.uid(), 'encargado'::app_role)
);

-- Update jornadas RLS: allow encargado to update (for approval)
DROP POLICY IF EXISTS "Jardineros actualizan sus jornadas" ON public.jornadas;
CREATE POLICY "Usuarios actualizan jornadas"
ON public.jornadas FOR UPDATE TO authenticated
USING (
  auth.uid() = jardinero_id 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'dueno'::app_role) 
  OR has_role(auth.uid(), 'encargado'::app_role)
);

-- Update compras RLS: allow encargado to update (approve)
DROP POLICY IF EXISTS "Admins actualizan compras" ON public.compras;
CREATE POLICY "Superiores actualizan compras"
ON public.compras FOR UPDATE TO authenticated
USING (
  auth.uid() = registrado_por
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'dueno'::app_role) 
  OR has_role(auth.uid(), 'encargado'::app_role)
);

-- Trigger for updated_at on trabajos_extras
CREATE TRIGGER set_trabajos_extras_updated_at
  BEFORE UPDATE ON public.trabajos_extras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable realtime for trabajos_extras
ALTER PUBLICATION supabase_realtime ADD TABLE public.trabajos_extras;
