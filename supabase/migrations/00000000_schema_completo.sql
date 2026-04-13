-- ============================================================
-- SCHEMA COMPLETO - Vitalia Garden App
-- Ejecutar en el SQL Editor de tu nuevo proyecto Supabase
-- ============================================================

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('dueno', 'admin', 'encargado', 'jardinero');
CREATE TYPE public.estado_registro AS ENUM ('pendiente', 'aprobado', 'rechazado');
CREATE TYPE public.estado_incidencia AS ENUM ('abierta', 'en_proceso', 'resuelta');
CREATE TYPE public.urgencia_level AS ENUM ('baja', 'media', 'alta');
CREATE TYPE public.tipo_gasto AS ENUM ('combustible', 'herramientas', 'material', 'comida', 'otro');
CREATE TYPE public.tipo_trabajo_extra AS ENUM ('reparacion_urgente', 'material_adicional', 'fuera_horario', 'otro');

-- PROFILES (extiende auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  pin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- JARDINES
CREATE TABLE public.jardines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  direccion text,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  admin_only boolean NOT NULL DEFAULT false,
  holded_project_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jardines ENABLE ROW LEVEL SECURITY;

-- ASIGNACIONES (trabajador ↔ jardín)
CREATE TABLE public.asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jardin_id uuid NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  jardinero_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dias_semana text[] NOT NULL DEFAULT '{}',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;

-- JORNADAS (check-in / check-out y registro manual de horas)
CREATE TABLE public.jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jardinero_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jardin_id uuid NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  entrada_at timestamptz NOT NULL DEFAULT now(),
  salida_at timestamptz,
  hora_inicio time,
  hora_fin time,
  total_horas numeric(5,2),
  duracion_minutos integer GENERATED ALWAYS AS (
    CASE WHEN salida_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (salida_at - entrada_at))::integer / 60
         ELSE NULL END
  ) STORED,
  descripcion text,
  estado public.estado_registro NOT NULL DEFAULT 'pendiente',
  exportado_holded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;

-- TRABAJOS EXTRAS
CREATE TABLE public.trabajos_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jardin_id uuid NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo public.tipo_trabajo_extra NOT NULL DEFAULT 'otro',
  descripcion text NOT NULL,
  horas numeric(5,2),
  importe numeric(10,2),
  con_desplazamiento boolean NOT NULL DEFAULT false,
  km_desplazamiento numeric(6,1),
  foto_url text,
  fotos_urls text[],
  estado public.estado_registro NOT NULL DEFAULT 'pendiente',
  notas_revision text,
  exportado_holded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trabajos_extras ENABLE ROW LEVEL SECURITY;

-- COMPRAS / GASTOS
CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jardin_id uuid NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  registrado_por uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  importe numeric(10,2),
  tipo_gasto public.tipo_gasto NOT NULL DEFAULT 'otro',
  estado_cobro text NOT NULL DEFAULT 'pendiente',
  foto_factura_url text,
  exportado_holded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

-- INCIDENCIAS
CREATE TABLE public.incidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jardin_id uuid NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  jardinero_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  urgencia public.urgencia_level NOT NULL DEFAULT 'media',
  estado public.estado_incidencia NOT NULL DEFAULT 'abierta',
  foto_url text,
  notas_resolucion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCIONES
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles: todos pueden leer, solo el propio usuario puede editar
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles: todos los autenticados pueden leer su propio rol
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT WITH CHECK (true);

-- jardines: todos los autenticados pueden leer
CREATE POLICY "jardines_select" ON public.jardines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "jardines_all" ON public.jardines FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'dueno', 'encargado'))
);

-- asignaciones
CREATE POLICY "asignaciones_select" ON public.asignaciones FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "asignaciones_all" ON public.asignaciones FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'dueno', 'encargado'))
);

-- jornadas
CREATE POLICY "jornadas_select" ON public.jornadas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "jornadas_insert" ON public.jornadas FOR INSERT WITH CHECK (auth.uid() = jardinero_id);
CREATE POLICY "jornadas_update" ON public.jornadas FOR UPDATE USING (
  auth.uid() = jardinero_id OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'dueno', 'encargado'))
);

-- trabajos_extras
CREATE POLICY "extras_select" ON public.trabajos_extras FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "extras_insert" ON public.trabajos_extras FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "extras_update" ON public.trabajos_extras FOR UPDATE USING (
  auth.uid() = usuario_id OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'dueno', 'encargado'))
);

-- compras
CREATE POLICY "compras_select" ON public.compras FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "compras_insert" ON public.compras FOR INSERT WITH CHECK (auth.uid() = registrado_por);
CREATE POLICY "compras_update" ON public.compras FOR UPDATE USING (
  auth.uid() = registrado_por OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'dueno', 'encargado'))
);

-- incidencias
CREATE POLICY "incidencias_select" ON public.incidencias FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "incidencias_insert" ON public.incidencias FOR INSERT WITH CHECK (auth.uid() = jardinero_id);
CREATE POLICY "incidencias_update" ON public.incidencias FOR UPDATE USING (
  auth.uid() = jardinero_id OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'dueno', 'encargado'))
);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('extras-fotos', 'extras-fotos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('compras-fotos', 'compras-fotos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('incidencias-fotos', 'incidencias-fotos', true) ON CONFLICT DO NOTHING;

CREATE POLICY "storage_public_read" ON storage.objects FOR SELECT USING (true);
CREATE POLICY "storage_auth_insert" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "storage_auth_update" ON storage.objects FOR UPDATE USING (auth.role() = 'authenticated');
