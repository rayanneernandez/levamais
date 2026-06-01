-- Tabela para códigos de verificação de login OTP
CREATE TABLE IF NOT EXISTS public.client_login_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf TEXT NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para melhorar performance
CREATE INDEX idx_client_login_codes_cpf ON public.client_login_verification_codes(cpf);
CREATE INDEX idx_client_login_codes_email ON public.client_login_verification_codes(email);
CREATE INDEX idx_client_login_codes_expires ON public.client_login_verification_codes(expires_at);

-- RLS policies
ALTER TABLE public.client_login_verification_codes ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver códigos (para debug)
CREATE POLICY "Admins can view login codes"
  ON public.client_login_verification_codes
  FOR SELECT
  USING (is_admin());

-- Função para limpar códigos expirados (chamada por cron)
CREATE OR REPLACE FUNCTION cleanup_expired_login_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.client_login_verification_codes
  WHERE expires_at < now() OR (used = true AND used_at < now() - interval '1 day');
END;
$$;