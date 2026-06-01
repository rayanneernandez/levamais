-- Criar tabela para logs de eventos das webhooks Asaas
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payment_id text,
  subscription_id text,
  customer_id text,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_asaas_webhook_events_created_at ON public.asaas_webhook_events(created_at DESC);
CREATE INDEX idx_asaas_webhook_events_event_type ON public.asaas_webhook_events(event_type);
CREATE INDEX idx_asaas_webhook_events_subscription_id ON public.asaas_webhook_events(subscription_id);
CREATE INDEX idx_asaas_webhook_events_processed ON public.asaas_webhook_events(processed);

-- RLS Policies
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
  ON public.asaas_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.asaas_webhook_events IS 'Armazena todos os eventos recebidos das webhooks Asaas para auditoria e debug';