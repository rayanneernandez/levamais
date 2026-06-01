-- Adicionar coluna attendant_code em store_managers
ALTER TABLE public.store_managers
ADD COLUMN attendant_code text;

-- Criar índice único para garantir que o código seja único por rede
CREATE UNIQUE INDEX idx_attendant_code_network ON public.store_managers(attendant_code, network_id) 
WHERE attendant_code IS NOT NULL;

-- Função para gerar o próximo código de atendente na rede
CREATE OR REPLACE FUNCTION public.generate_attendant_code(p_network_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  network_name text;
  network_code text;
BEGIN
  -- Buscar nome da rede
  SELECT UPPER(REGEXP_REPLACE(name, '[^A-Z0-9]', '', 'gi'))
  INTO network_name
  FROM networks
  WHERE id = p_network_id;
  
  -- Pegar o próximo número sequencial para essa rede
  SELECT COALESCE(MAX(CAST(SPLIT_PART(attendant_code, '_', 1) AS integer)), 0) + 1
  INTO next_number
  FROM store_managers
  WHERE network_id = p_network_id
    AND attendant_code IS NOT NULL
    AND is_attendant = true;
  
  -- Formato: NUMERO_REDE (ex: 1_KOHARA)
  RETURN next_number || '_' || network_name;
END;
$$;

-- Trigger para gerar código automaticamente quando marcar como atendente
CREATE OR REPLACE FUNCTION public.set_attendant_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se está marcando como atendente e ainda não tem código
  IF NEW.is_attendant = true AND NEW.attendant_code IS NULL THEN
    NEW.attendant_code := generate_attendant_code(NEW.network_id);
  END IF;
  
  -- Se está desmarcando como atendente, remover o código
  IF NEW.is_attendant = false THEN
    NEW.attendant_code := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_set_attendant_code ON public.store_managers;
CREATE TRIGGER trigger_set_attendant_code
  BEFORE INSERT OR UPDATE ON public.store_managers
  FOR EACH ROW
  EXECUTE FUNCTION set_attendant_code();