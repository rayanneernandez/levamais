-- Criar tabela de logs de SMS MEX10
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'mex10',
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  sms_code TEXT,
  status TEXT,
  raw_request JSONB,
  raw_response TEXT,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX idx_sms_logs_phone ON public.sms_logs(phone);
CREATE INDEX idx_sms_logs_created_at ON public.sms_logs(created_at DESC);
CREATE INDEX idx_sms_logs_provider ON public.sms_logs(provider);
CREATE INDEX idx_sms_logs_sent_by ON public.sms_logs(sent_by);

-- RLS policies
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Admin pode ver todos
CREATE POLICY "Admins can view all SMS logs"
  ON public.sms_logs
  FOR SELECT
  USING (is_admin());

-- Admin pode inserir
CREATE POLICY "Admins can insert SMS logs"
  ON public.sms_logs
  FOR INSERT
  WITH CHECK (is_admin());