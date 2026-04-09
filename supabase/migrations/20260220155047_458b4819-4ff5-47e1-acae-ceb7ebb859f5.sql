-- Add days of week to asignaciones for scheduling
ALTER TABLE public.asignaciones ADD COLUMN dias_semana text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.asignaciones.dias_semana IS 'Days of the week: lunes, martes, miercoles, jueves, viernes, sabado, domingo';