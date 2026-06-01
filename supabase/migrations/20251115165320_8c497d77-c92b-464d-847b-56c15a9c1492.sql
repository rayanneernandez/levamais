-- Remover a política problemática
DROP POLICY IF EXISTS "clients_can_view_their_notifications" ON client_notifications;

-- Criar função security definer para verificar acesso do cliente às notificações
CREATE OR REPLACE FUNCTION public.client_can_view_notification(_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM client_notification_recipients cnr
    INNER JOIN clients c ON c.id = cnr.client_id
    WHERE cnr.notification_id = _notification_id
      AND c.user_id = auth.uid()
  );
$$;

-- Criar política RLS usando a função security definer
CREATE POLICY "clients_can_view_their_notifications"
ON client_notifications
FOR SELECT
TO authenticated
USING (public.client_can_view_notification(id));