
-- Recrear políticas SELECT de profiles como PERMISSIVE (sintaxis correcta)
DROP POLICY IF EXISTS "Admins ven todos los perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios ven su perfil" ON public.profiles;

CREATE POLICY "Admins ven todos los perfiles"
  ON public.profiles FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'dueno'::app_role) OR
    has_role(auth.uid(), 'encargado'::app_role)
  );

CREATE POLICY "Usuarios ven su perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);
