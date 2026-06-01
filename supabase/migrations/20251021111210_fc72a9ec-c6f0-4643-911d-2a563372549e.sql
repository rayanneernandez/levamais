-- Adicionar campos de marketing à tabela networks
ALTER TABLE public.networks
ADD COLUMN email_marketing_limit INTEGER DEFAULT 0,
ADD COLUMN email_marketing_used INTEGER DEFAULT 0,
ADD COLUMN whatsapp_marketing_limit INTEGER DEFAULT 0,
ADD COLUMN whatsapp_marketing_used INTEGER DEFAULT 0,
ADD COLUMN email_marketing_price NUMERIC(10,2) DEFAULT 0,
ADD COLUMN whatsapp_marketing_price NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN public.networks.email_marketing_limit IS 'Quantidade total de e-mails marketing disponíveis por mês';
COMMENT ON COLUMN public.networks.email_marketing_used IS 'Quantidade de e-mails marketing já utilizados no mês';
COMMENT ON COLUMN public.networks.whatsapp_marketing_limit IS 'Quantidade total de disparos WhatsApp disponíveis por mês';
COMMENT ON COLUMN public.networks.whatsapp_marketing_used IS 'Quantidade de disparos WhatsApp já utilizados no mês';
COMMENT ON COLUMN public.networks.email_marketing_price IS 'Preço do pacote de e-mail marketing';
COMMENT ON COLUMN public.networks.whatsapp_marketing_price IS 'Preço do pacote de WhatsApp marketing';

-- Criar tabela para histórico de disparos de marketing
CREATE TABLE public.marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('email', 'whatsapp')),
  campaign_name TEXT NOT NULL,
  message_content TEXT NOT NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'completed', 'failed')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketing_campaigns
CREATE POLICY "Admins can manage all campaigns"
  ON public.marketing_campaigns
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can create own network campaigns"
  ON public.marketing_campaigns
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Network managers can view own network campaigns"
  ON public.marketing_campaigns
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can update own network campaigns"
  ON public.marketing_campaigns
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

-- Criar índices para performance
CREATE INDEX idx_marketing_campaigns_network_id ON public.marketing_campaigns(network_id);
CREATE INDEX idx_marketing_campaigns_created_at ON public.marketing_campaigns(created_at DESC);
CREATE INDEX idx_marketing_campaigns_status ON public.marketing_campaigns(status);