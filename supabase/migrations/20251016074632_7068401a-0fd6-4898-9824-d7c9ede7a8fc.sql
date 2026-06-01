-- Criar tabela para armazenar API Keys por network
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  key_type TEXT NOT NULL DEFAULT 'live' CHECK (key_type IN ('live', 'test')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  last_used_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_api_keys_network_id ON public.api_keys(network_id);
CREATE INDEX idx_api_keys_api_key ON public.api_keys(api_key) WHERE is_active = true;

-- RLS Policies
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Network managers podem ver suas próprias API keys
CREATE POLICY "Network managers can view own network api keys"
  ON public.api_keys
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager') 
    AND network_id = get_user_network_id(auth.uid())
  );

-- Network managers podem criar API keys para sua rede
CREATE POLICY "Network managers can create api keys"
  ON public.api_keys
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager') 
    AND network_id = get_user_network_id(auth.uid())
    AND created_by = auth.uid()
  );

-- Network managers podem atualizar suas API keys
CREATE POLICY "Network managers can update own api keys"
  ON public.api_keys
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'network_manager') 
    AND network_id = get_user_network_id(auth.uid())
  );

-- Admins podem ver todas as API keys
CREATE POLICY "Admins can view all api keys"
  ON public.api_keys
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar API key única
CREATE OR REPLACE FUNCTION generate_api_key(network_uuid UUID, key_type_param TEXT DEFAULT 'live')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_key TEXT;
  prefix TEXT;
BEGIN
  -- Definir prefixo baseado no tipo
  prefix := CASE 
    WHEN key_type_param = 'test' THEN 'leva_test_sk_'
    ELSE 'leva_live_sk_'
  END;
  
  -- Gerar chave única
  new_key := prefix || encode(gen_random_bytes(32), 'hex');
  
  RETURN new_key;
END;
$$;