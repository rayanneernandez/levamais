-- Adicionar políticas RLS para client_notification_recipients
-- Permitir que clientes vejam suas próprias notificações

-- Policy para SELECT (ler notificações)
DROP POLICY IF EXISTS "Clients can view their own notifications" ON client_notification_recipients;
CREATE POLICY "Clients can view their own notifications"
ON client_notification_recipients
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
);

-- Policy para UPDATE (marcar como lida)
DROP POLICY IF EXISTS "Clients can update their own notifications" ON client_notification_recipients;
CREATE POLICY "Clients can update their own notifications"
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