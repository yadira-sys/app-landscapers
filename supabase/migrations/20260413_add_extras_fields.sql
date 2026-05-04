-- Migration: add km_desplazamiento and fotos_urls to trabajos_extras
-- Run this in your Supabase SQL editor (https://supabase.com/dashboard → SQL Editor)

-- Add approximate displacement distance in km
ALTER TABLE public.trabajos_extras
  ADD COLUMN IF NOT EXISTS km_desplazamiento numeric(6,1) DEFAULT NULL;

-- Add array of photo/invoice URLs (multiple attachments per extra job)
ALTER TABLE public.trabajos_extras
  ADD COLUMN IF NOT EXISTS fotos_urls text[] DEFAULT NULL;

-- Add importe (total amount) if not already present
ALTER TABLE public.trabajos_extras
  ADD COLUMN IF NOT EXISTS importe numeric(10,2) DEFAULT NULL;

-- Add foto_url (legacy single photo) if not already present
ALTER TABLE public.trabajos_extras
  ADD COLUMN IF NOT EXISTS foto_url text DEFAULT NULL;

-- Add con_desplazamiento flag if not already present
ALTER TABLE public.trabajos_extras
  ADD COLUMN IF NOT EXISTS con_desplazamiento boolean NOT NULL DEFAULT false;

-- Remove Holded export tracking (no longer needed)
-- These columns remain in DB for safety but are no longer used by the app.
-- You can drop them later if desired:
-- ALTER TABLE public.trabajos_extras DROP COLUMN IF EXISTS exportado_holded;
-- ALTER TABLE public.jornadas        DROP COLUMN IF EXISTS exportado_holded;
-- ALTER TABLE public.compras         DROP COLUMN IF EXISTS exportado_holded;
