-- ==========================================
-- FASE 1: ÍNDICES COMPOSTOS PARA PERFORMANCE
-- ==========================================

-- Índice composto para lookup rápido de transações webPosto
CREATE INDEX IF NOT EXISTS idx_webposto_tx_lookup 
  ON public.webposto_transactions(id_transacao, codigo_venda, status);

-- Índice composto para busca de lojas por rede e CNPJ (apenas ativas)
CREATE INDEX IF NOT EXISTS idx_stores_network_cnpj 
  ON public.stores(network_id, cnpj) 
  WHERE status = 'active';

-- Índice composto para busca de clientes por CPF e rede
CREATE INDEX IF NOT EXISTS idx_clients_cpf_network 
  ON public.clients(cpf, network_id);

-- Índice composto para autenticação de API keys (apenas ativas)
CREATE INDEX IF NOT EXISTS idx_api_keys_auth 
  ON public.api_keys(api_key, network_id, is_active) 
  WHERE is_active = true;

-- Índice para data de venda (queries de relatórios)
CREATE INDEX IF NOT EXISTS idx_webposto_tx_data_venda 
  ON public.webposto_transactions(data_venda DESC, network_id);

-- ==========================================
-- FASE 3: TABELA DE RATE LIMITING
-- ==========================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text NOT NULL,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(api_key, endpoint, window_start)
);

-- Índice para cleanup rápido de dados antigos
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup 
  ON public.api_rate_limits(window_start);

-- Índice para verificação de rate limit
CREATE INDEX IF NOT EXISTS idx_rate_limits_check 
  ON public.api_rate_limits(api_key, endpoint, window_start);

-- Função para limpar rate limits antigos (mais de 1 hora)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$;

-- ==========================================
-- FASE 4: SISTEMA DE CACHE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.api_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  cache_value jsonb NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para lookup rápido por chave
CREATE INDEX IF NOT EXISTS idx_cache_key 
  ON public.api_cache(cache_key);

-- Índice para cleanup de cache expirado
CREATE INDEX IF NOT EXISTS idx_cache_expires 
  ON public.api_cache(expires_at);

-- Função para limpar cache expirado
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_cache
  WHERE expires_at < now();
END;
$$;

-- Função para get cache com verificação de expiração
CREATE OR REPLACE FUNCTION public.get_cache(key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT cache_value INTO result
  FROM public.api_cache
  WHERE cache_key = key
    AND expires_at > now();
  
  RETURN result;
END;
$$;

-- Função para set cache com TTL
CREATE OR REPLACE FUNCTION public.set_cache(key text, value jsonb, ttl_seconds integer DEFAULT 300)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.api_cache (cache_key, cache_value, expires_at)
  VALUES (key, value, now() + (ttl_seconds || ' seconds')::interval)
  ON CONFLICT (cache_key) 
  DO UPDATE SET 
    cache_value = EXCLUDED.cache_value,
    expires_at = EXCLUDED.expires_at,
    updated_at = now();
END;
$$;

-- ==========================================
-- RLS POLICIES
-- ==========================================

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode acessar (usado pelas edge functions)
CREATE POLICY "Service role can manage rate limits"
  ON public.api_rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage cache"
  ON public.api_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);