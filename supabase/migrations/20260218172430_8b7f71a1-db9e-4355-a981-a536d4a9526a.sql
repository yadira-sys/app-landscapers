
-- Añadir FK de jornadas.jardinero_id -> profiles.id (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'jornadas_jardinero_id_fkey' AND table_name = 'jornadas'
  ) THEN
    ALTER TABLE public.jornadas
      ADD CONSTRAINT jornadas_jardinero_id_fkey
      FOREIGN KEY (jardinero_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Añadir FK de asignaciones.jardinero_id -> profiles.id (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'asignaciones_jardinero_id_fkey' AND table_name = 'asignaciones'
  ) THEN
    ALTER TABLE public.asignaciones
      ADD CONSTRAINT asignaciones_jardinero_id_fkey
      FOREIGN KEY (jardinero_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Añadir FK de user_roles.user_id -> profiles.id (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_roles_user_id_profiles_fkey' AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
