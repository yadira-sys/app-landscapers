
-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('dueno', 'admin', 'encargado', 'jardinero');

-- Tabla de perfiles públicos
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de roles (separada, nunca en profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Función para comprobar rol (security definer para evitar recursión en RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Tabla de jardines
CREATE TABLE public.jardines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  direccion TEXT,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de asignaciones jardinero ↔ jardín
CREATE TABLE public.asignaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jardinero_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jardin_id UUID NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (jardinero_id, jardin_id)
);

-- Tabla de jornadas (check-in / check-out)
CREATE TABLE public.jornadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jardinero_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jardin_id UUID NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  entrada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  salida_at TIMESTAMPTZ,
  duracion_minutos INTEGER GENERATED ALWAYS AS (
    CASE WHEN salida_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (salida_at - entrada_at))::INTEGER / 60
    ELSE NULL END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enum urgencia
CREATE TYPE public.urgencia_level AS ENUM ('baja', 'media', 'alta');

-- Enum estado incidencia
CREATE TYPE public.estado_incidencia AS ENUM ('abierta', 'en_proceso', 'resuelta');

-- Tabla de incidencias
CREATE TABLE public.incidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jardinero_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jardin_id UUID NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  urgencia urgencia_level NOT NULL DEFAULT 'baja',
  estado estado_incidencia NOT NULL DEFAULT 'abierta',
  foto_url TEXT,
  notas_resolucion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER jardines_updated_at BEFORE UPDATE ON public.jardines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER incidencias_updated_at BEFORE UPDATE ON public.incidencias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket para fotos de incidencias
INSERT INTO storage.buckets (id, name, public) VALUES ('incidencias-fotos', 'incidencias-fotos', true);

-- =========== RLS ===========

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jardines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Usuarios ven su perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins ven todos los perfiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno') OR public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Usuarios actualizan su perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins insertan perfiles" ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno'));

-- USER_ROLES
CREATE POLICY "Admins ven roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno'));
CREATE POLICY "Usuarios ven su propio rol" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins gestionan roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno'));

-- JARDINES
CREATE POLICY "Todos los autenticados ven jardines" ON public.jardines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/Encargados gestionan jardines" ON public.jardines FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno') OR public.has_role(auth.uid(), 'encargado'));

-- ASIGNACIONES
CREATE POLICY "Jardineros ven sus asignaciones" ON public.asignaciones FOR SELECT USING (auth.uid() = jardinero_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno') OR public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Admins/Encargados gestionan asignaciones" ON public.asignaciones FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno') OR public.has_role(auth.uid(), 'encargado'));

-- JORNADAS
CREATE POLICY "Jardineros ven sus jornadas" ON public.jornadas FOR SELECT USING (auth.uid() = jardinero_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno') OR public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Jardineros insertan sus jornadas" ON public.jornadas FOR INSERT WITH CHECK (auth.uid() = jardinero_id);
CREATE POLICY "Jardineros actualizan sus jornadas" ON public.jornadas FOR UPDATE USING (auth.uid() = jardinero_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno'));

-- INCIDENCIAS
CREATE POLICY "Jardineros ven sus incidencias" ON public.incidencias FOR SELECT USING (auth.uid() = jardinero_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno') OR public.has_role(auth.uid(), 'encargado'));
CREATE POLICY "Jardineros crean incidencias" ON public.incidencias FOR INSERT WITH CHECK (auth.uid() = jardinero_id);
CREATE POLICY "Encargados/Admins actualizan incidencias" ON public.incidencias FOR UPDATE USING (auth.uid() = jardinero_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dueno') OR public.has_role(auth.uid(), 'encargado'));

-- STORAGE
CREATE POLICY "Autenticados suben fotos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'incidencias-fotos');
CREATE POLICY "Fotos son públicas" ON storage.objects FOR SELECT USING (bucket_id = 'incidencias-fotos');
CREATE POLICY "Autenticados borran sus fotos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'incidencias-fotos');
