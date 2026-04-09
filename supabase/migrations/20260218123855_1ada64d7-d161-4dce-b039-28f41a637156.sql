
-- Añadir FK de compras.registrado_por → profiles.id
ALTER TABLE public.compras
  ADD CONSTRAINT compras_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES public.profiles(id) ON DELETE CASCADE;
