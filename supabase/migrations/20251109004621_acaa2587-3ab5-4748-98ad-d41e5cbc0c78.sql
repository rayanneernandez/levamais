-- Tabela para armazenar push subscriptions dos clientes
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(client_id, endpoint)
);

-- Índices para performance
CREATE INDEX idx_push_subscriptions_client_id ON public.push_subscriptions(client_id);
CREATE INDEX idx_push_subscriptions_is_active ON public.push_subscriptions(is_active);
CREATE INDEX idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- RLS Policies
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Network managers can view network push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role)
    AND client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.favorite_network_id = get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Admins can manage all push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();