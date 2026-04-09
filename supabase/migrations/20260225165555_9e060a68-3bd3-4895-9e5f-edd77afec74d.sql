
-- Drop existing restrictive policies on user_roles
DROP POLICY IF EXISTS "Admins gestionan roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins ven roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios ven su propio rol" ON public.user_roles;

-- Recreate as PERMISSIVE (default) so any ONE matching policy grants access
CREATE POLICY "Usuarios ven su propio rol"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins ven todos los roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dueno'::app_role));

CREATE POLICY "Admins gestionan roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dueno'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dueno'::app_role));
