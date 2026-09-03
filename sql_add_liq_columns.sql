-- Separar las liquidaciones: una para moto, otra para comercio
ALTER TABLE pedidos 
  ADD COLUMN IF NOT EXISTS liquidacion_moto_id uuid REFERENCES liquidaciones(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS liquidacion_comercio_id uuid REFERENCES liquidaciones(id) DEFAULT NULL;

-- Migrar la data si existe alguna liquidacion vieja (opcional, por si acaso)
UPDATE pedidos SET 
  liquidacion_moto_id = liquidacion_id, 
  liquidacion_comercio_id = liquidacion_id 
WHERE liquidacion_id IS NOT NULL;
