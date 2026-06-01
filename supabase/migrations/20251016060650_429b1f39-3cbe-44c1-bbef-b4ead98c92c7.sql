-- Remove a constraint antiga
ALTER TABLE store_managers DROP CONSTRAINT IF EXISTS store_managers_user_id_network_id_key;

-- Cria índice único para network managers (store_id null)
CREATE UNIQUE INDEX IF NOT EXISTS store_managers_network_unique 
  ON store_managers (user_id, network_id) 
  WHERE store_id IS NULL;

-- Cria índice único para store managers (store_id específico)
CREATE UNIQUE INDEX IF NOT EXISTS store_managers_store_unique 
  ON store_managers (user_id, network_id, store_id) 
  WHERE store_id IS NOT NULL;