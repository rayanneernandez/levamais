-- Tabela principal de notificações
CREATE TABLE public.client_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 100),
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  sent_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de destinatários e status de leitura
CREATE TABLE public.client_notification_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.client_notifications(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notification_id, client_id)
);

-- Índices para performance
CREATE INDEX idx_client_notifications_network_id ON public.client_notifications(network_id);
CREATE INDEX idx_client_notifications_created_at ON public.client_notifications(created_at DESC);
CREATE INDEX idx_notification_recipients_client_id ON public.client_notification_recipients(client_id);
CREATE INDEX idx_notification_recipients_is_read ON public.client_notification_recipients(is_read);
CREATE INDEX idx_notification_recipients_notification_id ON public.client_notification_recipients(notification_id);

-- Trigger para atualizar contador de leituras automaticamente
CREATE OR REPLACE FUNCTION public.update_notification_read_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    UPDATE public.client_notifications
    SET read_count = read_count + 1,
        updated_at = now()
    WHERE id = NEW.notification_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_notification_read_count
  AFTER UPDATE ON public.client_notification_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_read_count();

-- RLS Policies para client_notifications
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all notifications"
  ON public.client_notifications
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can create own network notifications"
  ON public.client_notifications
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Network managers can view own network notifications"
  ON public.client_notifications
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can update own network notifications"
  ON public.client_notifications
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

-- RLS Policies para client_notification_recipients
ALTER TABLE public.client_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own notification recipients"
  ON public.client_notification_recipients
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update own notification recipients"
  ON public.client_notification_recipients
  FOR UPDATE
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

CREATE POLICY "Network managers can create notification recipients"
  ON public.client_notification_recipients
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role)
    AND client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.favorite_network_id = get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Network managers can view own network notification recipients"
  ON public.client_notification_recipients
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role)
    AND notification_id IN (
      SELECT id FROM public.client_notifications
      WHERE network_id = get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Admins can manage all notification recipients"
  ON public.client_notification_recipients
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_notification_recipients;