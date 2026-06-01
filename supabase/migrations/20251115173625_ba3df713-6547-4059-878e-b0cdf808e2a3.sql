-- Tabela de templates aprovados do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_category TEXT NOT NULL, -- MARKETING, UTILITY, AUTHENTICATION
  language TEXT NOT NULL DEFAULT 'pt_BR',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  body_text TEXT NOT NULL,
  parameters_count INTEGER DEFAULT 0,
  header_type TEXT, -- text, image, video, document
  footer_text TEXT,
  buttons JSONB, -- botões de ação
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(network_id, template_name, language)
);

-- Tabela de fila de mensagens WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message_type TEXT NOT NULL, -- text, template, media
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  template_name TEXT,
  template_params JSONB,
  message_text TEXT,
  media_url TEXT,
  media_type TEXT, -- image, video, document
  priority INTEGER DEFAULT 5, -- 1-10, menor = maior prioridade
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, sent, failed, cancelled
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  wamid TEXT, -- WhatsApp message ID
  campaign_id UUID,
  is_promotional BOOLEAN DEFAULT false, -- true = cobrado do cliente
  cost NUMERIC(10,4) DEFAULT 0,
  metadata JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de logs de envio
CREATE TABLE IF NOT EXISTS public.whatsapp_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES public.whatsapp_message_queue(id) ON DELETE SET NULL,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL, -- out, in
  message_type TEXT NOT NULL,
  template_name TEXT,
  body_text TEXT,
  wamid TEXT,
  status TEXT NOT NULL,
  api_response JSONB,
  error_details TEXT,
  cost NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de controle de rate limiting
CREATE TABLE IF NOT EXISTS public.whatsapp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  max_messages_per_minute INTEGER DEFAULT 80, -- WhatsApp permite ~80/min
  max_messages_per_hour INTEGER DEFAULT 1000,
  max_messages_per_day INTEGER DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(network_id, window_start)
);

-- Tabela de histórico de conversas (webhook)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  wa_id TEXT NOT NULL, -- WhatsApp ID do remetente
  phone TEXT NOT NULL,
  direction TEXT NOT NULL, -- in, out
  message_type TEXT NOT NULL,
  body_text TEXT,
  media_url TEXT,
  wamid TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status ON public.whatsapp_message_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_network ON public.whatsapp_message_queue(network_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_client ON public.whatsapp_message_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_network ON public.whatsapp_send_logs(network_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON public.whatsapp_send_logs(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_history_network ON public.whatsapp_conversation_history(network_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_history_phone ON public.whatsapp_conversation_history(phone, created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_updated_at();

CREATE TRIGGER update_whatsapp_queue_updated_at
  BEFORE UPDATE ON public.whatsapp_message_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_updated_at();

CREATE TRIGGER update_whatsapp_rate_limits_updated_at
  BEFORE UPDATE ON public.whatsapp_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_updated_at();

-- RLS Policies
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_history ENABLE ROW LEVEL SECURITY;

-- Admin pode ver tudo
CREATE POLICY "Admin full access whatsapp_templates" ON public.whatsapp_templates FOR ALL USING (is_admin());
CREATE POLICY "Admin full access whatsapp_queue" ON public.whatsapp_message_queue FOR ALL USING (is_admin());
CREATE POLICY "Admin full access whatsapp_logs" ON public.whatsapp_send_logs FOR ALL USING (is_admin());
CREATE POLICY "Admin full access whatsapp_rate" ON public.whatsapp_rate_limits FOR ALL USING (is_admin());
CREATE POLICY "Admin full access whatsapp_history" ON public.whatsapp_conversation_history FOR ALL USING (is_admin());

-- Store managers podem ver/editar da sua rede
CREATE POLICY "Store managers can view templates" ON public.whatsapp_templates 
  FOR SELECT USING (network_id = get_user_network_id(auth.uid()));

CREATE POLICY "Store managers can view queue" ON public.whatsapp_message_queue 
  FOR SELECT USING (network_id = get_user_network_id(auth.uid()));

CREATE POLICY "Store managers can view logs" ON public.whatsapp_send_logs 
  FOR SELECT USING (network_id = get_user_network_id(auth.uid()));

CREATE POLICY "Store managers can view history" ON public.whatsapp_conversation_history 
  FOR SELECT USING (network_id = get_user_network_id(auth.uid()));