-- Remover todas as políticas antigas duplicadas
DROP POLICY IF EXISTS "Clients can view own notification recipients" ON client_notification_recipients;
DROP POLICY IF EXISTS "Clients can view their own notifications" ON client_notification_recipients;
DROP POLICY IF EXISTS "Clients can update own notification recipients" ON client_notification_recipients;
DROP POLICY IF EXISTS "Clients can update their own notifications" ON client_notification_recipients;

-- Criar políticas corretas e únicas
CREATE POLICY "clients_select_own_notifications"
ON client_notification_recipients
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
);

CREATE POLICY "clients_update_own_notifications"
ON client_notification_recipients
FOR UPDATE
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
);