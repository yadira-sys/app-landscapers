
-- Recrear políticas de asignaciones como PERMISSIVE
DROP POLICY IF EXISTS "Admins/Encargados gestionan asignaciones" ON public.asignaciones;
DROP POLICY IF EXISTS "Jardineros ven sus asignaciones" ON public.asignaciones;

CREATE POLICY "Admins/Encargados gestionan asignaciones"
  ON public.asignaciones FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'dueno'::app_role) OR
    has_role(auth.uid(), 'encargado'::app_role)
  );

CREATE POLICY "Jardineros ven sus asignaciones"
  ON public.asignaciones FOR SELECT
  USING (
    auth.uid() = jardinero_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'dueno'::app_role) OR
    has_role(auth.uid(), 'encargado'::app_role)
  );
