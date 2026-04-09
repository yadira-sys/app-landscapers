CREATE POLICY "Admins insertan incidencias"
ON public.incidencias
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dueno'::app_role) OR has_role(auth.uid(), 'encargado'::app_role)
);