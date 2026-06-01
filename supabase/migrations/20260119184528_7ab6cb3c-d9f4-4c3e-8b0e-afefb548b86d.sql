-- Função para gerar código de atendente automático (sequencial_REDE)
CREATE OR REPLACE FUNCTION generate_attendant_code()
RETURNS TRIGGER AS $$
DECLARE
  network_name TEXT;
  next_seq INTEGER;
  clean_network_name TEXT;
BEGIN
  -- Só gerar se for atendente e não tiver código definido
  IF NEW.is_attendant = true AND (NEW.attendant_code IS NULL OR NEW.attendant_code = '') THEN
    -- Buscar nome da rede
    SELECT name INTO network_name
    FROM networks
    WHERE id = NEW.network_id;
    
    -- Limpar nome da rede: remover espaços e caracteres especiais, converter para maiúsculo
    clean_network_name := UPPER(REGEXP_REPLACE(network_name, '[^a-zA-Z0-9]', '', 'g'));
    
    -- Contar atendentes existentes na rede para gerar sequencial
    SELECT COUNT(*) + 1 INTO next_seq
    FROM store_managers
    WHERE network_id = NEW.network_id 
    AND is_attendant = true
    AND attendant_code IS NOT NULL;
    
    -- Gerar código no formato: 1_REDEKOHARA
    NEW.attendant_code := next_seq::TEXT || '_' || clean_network_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar código automático
DROP TRIGGER IF EXISTS set_attendant_code ON store_managers;
CREATE TRIGGER set_attendant_code
BEFORE INSERT OR UPDATE ON store_managers
FOR EACH ROW
EXECUTE FUNCTION generate_attendant_code();

-- Atualizar atendentes existentes que não têm código
DO $$
DECLARE
  rec RECORD;
  network_name TEXT;
  clean_network_name TEXT;
  next_seq INTEGER;
BEGIN
  FOR rec IN 
    SELECT sm.id, sm.network_id 
    FROM store_managers sm
    WHERE sm.is_attendant = true 
    AND (sm.attendant_code IS NULL OR sm.attendant_code = '')
  LOOP
    -- Buscar nome da rede
    SELECT name INTO network_name FROM networks WHERE id = rec.network_id;
    clean_network_name := UPPER(REGEXP_REPLACE(network_name, '[^a-zA-Z0-9]', '', 'g'));
    
    -- Contar atendentes existentes
    SELECT COUNT(*) INTO next_seq
    FROM store_managers
    WHERE network_id = rec.network_id 
    AND is_attendant = true
    AND attendant_code IS NOT NULL;
    
    next_seq := next_seq + 1;
    
    -- Atualizar código
    UPDATE store_managers 
    SET attendant_code = next_seq::TEXT || '_' || clean_network_name
    WHERE id = rec.id;
  END LOOP;
END $$;