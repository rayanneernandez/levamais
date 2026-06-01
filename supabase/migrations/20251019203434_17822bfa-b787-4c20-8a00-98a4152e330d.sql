-- Criar tabela para tokens de API externos
CREATE TABLE public.external_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.external_api_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage all tokens"
ON public.external_api_tokens
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own network tokens"
ON public.external_api_tokens
FOR SELECT
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can create own network tokens"
ON public.external_api_tokens
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Network managers can update own network tokens"
ON public.external_api_tokens
FOR UPDATE
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
);

-- Índices para performance
CREATE INDEX idx_external_api_tokens_token ON public.external_api_tokens(token) WHERE is_active = true;
CREATE INDEX idx_external_api_tokens_network ON public.external_api_tokens(network_id);

-- Comentários
COMMENT ON TABLE public.external_api_tokens IS 'Tokens de API para acesso externo aos dados de transações';
COMMENT ON COLUMN public.external_api_tokens.token IS 'Token gerado para autenticação da API';
COMMENT ON COLUMN public.external_api_tokens.last_used_at IS 'Última vez que o token foi utilizado';