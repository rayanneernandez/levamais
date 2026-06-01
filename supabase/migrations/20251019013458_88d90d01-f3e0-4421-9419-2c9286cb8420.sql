-- Adicionar campo para controlar troca de rede favorita
ALTER TABLE public.clients 
ADD COLUMN favorite_network_changed_at timestamp with time zone DEFAULT now();

-- Criar função para verificar se cliente pode trocar de rede favorita (90 dias)
CREATE OR REPLACE FUNCTION public.can_change_favorite_network(client_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_change timestamp with time zone;
BEGIN
  SELECT favorite_network_changed_at INTO last_change
  FROM clients
  WHERE id = client_uuid;
  
  -- Se nunca trocou ou já passaram 90 dias
  RETURN last_change IS NULL OR (now() - last_change) >= interval '90 days';
END;
$$;

-- Criar função para obter redes onde o cliente tem visibilidade completa
-- (rede favorita atual tem acesso completo aos dados)
CREATE OR REPLACE FUNCTION public.get_client_full_access_networks(client_uuid uuid)
RETURNS TABLE(network_uuid uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT favorite_network_id
  FROM clients
  WHERE id = client_uuid AND favorite_network_id IS NOT NULL;
END;
$$;

-- Trigger para atualizar data de troca quando favorite_network_id mudar
CREATE OR REPLACE FUNCTION public.update_favorite_network_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se favorite_network_id mudou, atualizar a data
  IF OLD.favorite_network_id IS DISTINCT FROM NEW.favorite_network_id THEN
    NEW.favorite_network_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_favorite_network_changed_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_favorite_network_changed_at();