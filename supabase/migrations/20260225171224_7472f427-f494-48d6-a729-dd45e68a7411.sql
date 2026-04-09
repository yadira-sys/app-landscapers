
-- Drop existing restrictive SELECT policies on profiles
DROP POLICY IF EXISTS "Admins ven todos los perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios ven su perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins insertan perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios actualizan su perfil" ON public.profiles;

-- Recreate as PERMISSIVE
CREATE POLICY "Usuarios ven su perfil"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins ven todos los perfiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dueno'::app_role) OR has_role(auth.uid(), 'encargado'::app_role));

CREATE POLICY "Admins insertan perfiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dueno'::app_role));

CREATE POLICY "Usuarios actualizan su perfil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);
