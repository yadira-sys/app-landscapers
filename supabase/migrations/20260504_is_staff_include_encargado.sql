-- Include encargado in is_staff() so supervisors can see full team lists
-- (profiles, jornadas, asignaciones lookups all gate on this function)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'dueno', 'encargado')
  );
$$;
