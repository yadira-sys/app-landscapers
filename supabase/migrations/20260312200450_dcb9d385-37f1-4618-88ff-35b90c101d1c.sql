
-- Add exportado_holded column to jornadas, compras, and trabajos_extras
ALTER TABLE public.jornadas ADD COLUMN IF NOT EXISTS exportado_holded boolean NOT NULL DEFAULT false;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS exportado_holded boolean NOT NULL DEFAULT false;
ALTER TABLE public.trabajos_extras ADD COLUMN IF NOT EXISTS exportado_holded boolean NOT NULL DEFAULT false;
