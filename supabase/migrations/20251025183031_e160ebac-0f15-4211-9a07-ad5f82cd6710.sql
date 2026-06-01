-- Criar tabela para eventos de email
CREATE TABLE public.email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- sent, delivered, opened, clicked, bounced, complained
  email_to TEXT NOT NULL,
  email_subject TEXT,
  resend_email_id TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_email_events_budget_id ON public.email_events(budget_id);
CREATE INDEX idx_email_events_type ON public.email_events(event_type);
CREATE INDEX idx_email_events_occurred_at ON public.email_events(occurred_at DESC);

-- RLS Policies
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todos os eventos
CREATE POLICY "Admins can view all email events"
  ON public.email_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Comercial pode ver eventos dos próprios orçamentos
CREATE POLICY "Commercial users can view own budget email events"
  ON public.email_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = email_events.budget_id
      AND (b.seller_id = auth.uid() OR b.created_by = auth.uid())
    )
  );

-- Sistema pode criar eventos (via webhook)
CREATE POLICY "System can create email events"
  ON public.email_events
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.email_events IS 'Armazena eventos de email do Resend (webhooks)';
COMMENT ON COLUMN public.email_events.event_type IS 'Tipos: sent, delivered, opened, clicked, bounced, complained';
COMMENT ON COLUMN public.email_events.resend_email_id IS 'ID do email no Resend para correlação';