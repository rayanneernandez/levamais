-- Adicionar política RLS para clientes visualizarem suas notificações
CREATE POLICY "clients_can_view_their_notifications"
ON client_notifications
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT notification_id 
    FROM client_notification_recipients cnr
    INNER JOIN clients c ON c.id = cnr.client_id
    WHERE c.user_id = auth.uid()
  )
);