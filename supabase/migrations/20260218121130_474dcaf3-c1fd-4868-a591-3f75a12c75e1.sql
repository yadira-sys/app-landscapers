
-- Tabla compras
CREATE TABLE public.compras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jardin_id uuid NOT NULL REFERENCES public.jardines(id) ON DELETE CASCADE,
  registrado_por uuid NOT NULL,
  descripcion text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  foto_factura_url text,
  estado_cobro text NOT NULL DEFAULT 'pendiente' CHECK (estado_cobro IN ('pendiente', 'se_cobra', 'no_se_cobra')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER set_compras_updated_at
  BEFORE UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden insertar (sus propias compras)
CREATE POLICY "Trabajadores insertan sus compras"
  ON public.compras FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = registrado_por);

-- Cada usuario ve las suyas, admin/dueño ven todas
CREATE POLICY "Trabajadores ven sus compras"
  ON public.compras FOR SELECT
  TO authenticated
  USING (
    auth.uid() = registrado_por
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'dueno'::app_role)
    OR has_role(auth.uid(), 'encargado'::app_role)
  );

-- Solo admin/dueño actualizan (incluido estado_cobro)
CREATE POLICY "Admins actualizan compras"
  ON public.compras FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'dueno'::app_role)
  );

-- Solo admin/dueño eliminan
CREATE POLICY "Admins eliminan compras"
  ON public.compras FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'dueno'::app_role)
  );

-- Bucket para facturas
INSERT INTO storage.buckets (id, name, public)
VALUES ('compras-facturas', 'compras-facturas', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Autenticados suben facturas"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'compras-facturas');

CREATE POLICY "Facturas publicas"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'compras-facturas');

CREATE POLICY "Admins eliminan facturas"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'compras-facturas'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'dueno'::app_role)
    )
  );
