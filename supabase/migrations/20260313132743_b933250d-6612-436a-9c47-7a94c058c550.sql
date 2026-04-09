ALTER TABLE jardines ADD COLUMN admin_only boolean NOT NULL DEFAULT false;

UPDATE jardines SET admin_only = true WHERE nombre IN ('Gastos generales', 'Venta productos', 'Trabajos administración');