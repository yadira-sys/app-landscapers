
-- Add foreign keys from jardinero_id columns to profiles(id) so PostgREST joins work
ALTER TABLE public.asignaciones
ADD CONSTRAINT asignaciones_jardinero_id_profiles_fkey
FOREIGN KEY (jardinero_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.jornadas
ADD CONSTRAINT jornadas_jardinero_id_profiles_fkey
FOREIGN KEY (jardinero_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.incidencias
ADD CONSTRAINT incidencias_jardinero_id_profiles_fkey
FOREIGN KEY (jardinero_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
