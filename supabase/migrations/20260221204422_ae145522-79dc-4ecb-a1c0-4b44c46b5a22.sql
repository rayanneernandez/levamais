
-- Tabela para armazenar tokens Expo Push
CREATE TABLE public.expo_push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  expo_token TEXT NOT NULL,
  device_name TEXT,
  platform TEXT NOT NULL DEFAULT 'android',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE UNIQUE INDEX idx_expo_push_tokens_client_token ON public.expo_push_tokens(client_id, expo_token);
CREATE INDEX idx_expo_push_tokens_active ON public.expo_push_tokens(is_active) WHERE is_active = true;

-- Trigger para updated_at
CREATE TRIGGER update_expo_push_tokens_updated_at
  BEFORE UPDATE ON public.expo_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.expo_push_tokens ENABLE ROW LEVEL SECURITY;

-- App não-autenticado pode registrar tokens (INSERT/UPDATE via upsert)
CREATE POLICY "Allow public insert of expo tokens"
  ON public.expo_push_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update of expo tokens"
  ON public.expo_push_tokens FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Leitura apenas via service_role (edge functions)
CREATE POLICY "Allow service role to read expo tokens"
  ON public.expo_push_tokens FOR SELECT
  USING (auth.role() = 'service_role');
