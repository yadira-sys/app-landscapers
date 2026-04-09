-- Rename existing gardens to match Holded project names exactly
UPDATE jardines SET nombre = 'Mant Arrayanes' WHERE id = '970cacc9-e205-46d9-8144-a28375902899';
UPDATE jardines SET nombre = 'Mant Cartuja' WHERE id = 'c02eafb0-7212-4b29-b2dd-8b0ad37c794c';
UPDATE jardines SET nombre = 'Mant Epic Marbella' WHERE id = '604af21a-50d1-441e-a218-d3af9c7cd8d3';
UPDATE jardines SET nombre = 'Mant Marein Banús' WHERE id = 'c0ff1afe-ed28-4937-921c-cf6ed5675a6a';
UPDATE jardines SET nombre = 'Mant Nagueles' WHERE id = '90d4cd8e-5f95-4831-a0e7-95c8f6c093ea';
UPDATE jardines SET nombre = 'Mant Natura 4' WHERE id = '2bbf13f8-46a5-4197-93c9-de94346ae112';
UPDATE jardines SET nombre = 'Mant Natura 1' WHERE id = '3881f6b1-c56a-4408-80dc-5c4d83ef134a';
UPDATE jardines SET nombre = 'Mant Natura 2' WHERE id = '4dc831c1-b9f5-4149-ad24-4e5fabd38c06';
UPDATE jardines SET nombre = 'Mant Palacetes 3' WHERE id = '0c6f968b-a3e2-4875-ade6-c8436fd9c902';
UPDATE jardines SET nombre = 'Mant Palacetes V5' WHERE id = 'b7e2fe29-26d7-4c37-9ca8-5a39b96bb13f';
UPDATE jardines SET nombre = 'Mant Rafa Guadalmina' WHERE id = '3743af76-7e32-42b2-93dc-4dd3a40f7e49';
UPDATE jardines SET nombre = 'Mant Rio Real' WHERE id = 'c2dba8a3-9f37-4019-9197-a63cbe10d543';
UPDATE jardines SET nombre = 'Mant Santa Clara' WHERE id = 'bbc162a4-86c7-4ac2-9058-c12347ce55a1';
UPDATE jardines SET nombre = 'Mant Santiago' WHERE id = '737d9739-7b76-4eeb-8ed5-e2ce6da58f75';

-- Add missing Holded projects as gardens
INSERT INTO jardines (nombre, descripcion) VALUES
  ('Obras pequeñas', 'Obras pequeñas'),
  ('Obra Palacetes V8', 'Obra Palacetes V8'),
  ('Obra Marein Natura 3', 'Obra Marein Natura 3'),
  ('Gastos generales', 'Solo acceso admin'),
  ('Venta productos', 'Solo acceso admin'),
  ('Trabajos administración', 'Solo acceso admin');