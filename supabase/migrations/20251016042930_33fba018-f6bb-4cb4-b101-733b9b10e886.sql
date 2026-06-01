-- Adicionar coluna de código único para clientes
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS codigo text UNIQUE;

-- Criar sequência para gerar códigos numéricos
CREATE SEQUENCE IF NOT EXISTS clients_codigo_seq START WITH 1;

-- Criar função para gerar código automaticamente
CREATE OR REPLACE FUNCTION public.generate_client_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Gera código no formato CLI-000001
  IF NEW.codigo IS NULL THEN
    NEW.codigo := 'CLI-' || LPAD(nextval('clients_codigo_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger para gerar código antes de inserir
DROP TRIGGER IF EXISTS trigger_generate_client_codigo ON public.clients;
CREATE TRIGGER trigger_generate_client_codigo
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_client_codigo();

-- Gerar códigos para clientes existentes (se houver)
DO $$
DECLARE
  client_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR client_record IN 
    SELECT id FROM public.clients WHERE codigo IS NULL ORDER BY created_at
  LOOP
    UPDATE public.clients 
    SET codigo = 'CLI-' || LPAD(counter::text, 6, '0')
    WHERE id = client_record.id;
    counter := counter + 1;
  END LOOP;
  
  -- Atualizar a sequência para o próximo número
  PERFORM setval('clients_codigo_seq', counter);
END $$;