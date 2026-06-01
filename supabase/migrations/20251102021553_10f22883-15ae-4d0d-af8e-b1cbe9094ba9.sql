-- Criar tabela para códigos de verificação de reajustes
CREATE TABLE IF NOT EXISTS public.adjustment_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  code text NOT NULL,
  email text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  adjustment_data jsonb NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  used_at timestamp with time zone
);

-- Index para busca rápida
CREATE INDEX idx_adjustment_verification_codes_network_code ON public.adjustment_verification_codes(network_id, code) WHERE used = false;
CREATE INDEX idx_adjustment_verification_codes_expires ON public.adjustment_verification_codes(expires_at) WHERE used = false;

-- RLS
ALTER TABLE public.adjustment_verification_codes ENABLE ROW LEVEL SECURITY;

-- Policy: usuários autenticados podem inserir códigos
CREATE POLICY "Authenticated users can insert verification codes"
ON public.adjustment_verification_codes
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: usuários podem ver códigos da própria rede
CREATE POLICY "Users can view codes from their network"
ON public.adjustment_verification_codes
FOR SELECT
TO authenticated
USING (
  network_id IN (
    SELECT network_id FROM public.store_managers WHERE user_id = auth.uid()
  )
);

-- Policy: usuários podem atualizar códigos da própria rede
CREATE POLICY "Users can update codes from their network"
ON public.adjustment_verification_codes
FOR UPDATE
TO authenticated
USING (
  network_id IN (
    SELECT network_id FROM public.store_managers WHERE user_id = auth.uid()
  )
);

-- Função para limpar códigos expirados (será chamada periodicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_adjustment_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.adjustment_verification_codes
  WHERE expires_at < now() OR (used = true AND used_at < now() - interval '1 day');
END;
$$;