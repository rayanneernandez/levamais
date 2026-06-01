-- Corrigir função create_client_notification para aceitar NULL no created_by
-- e usar um UUID de sistema quando não fornecido

-- Primeiro, atualizar a função create_client_notification para lidar com created_by NULL
CREATE OR REPLACE FUNCTION create_client_notification(
  p_client_id UUID,
  p_network_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_created_by UUID;
BEGIN
  -- Se created_by for NULL, usar o client_id como criador da notificação (auto-notificação)
  -- Buscar o user_id do cliente para usar como created_by
  IF p_created_by IS NULL THEN
    SELECT user_id INTO v_created_by
    FROM clients
    WHERE id = p_client_id;
  ELSE
    v_created_by := p_created_by;
  END IF;
  
  -- Se ainda for NULL, não criar a notificação (cliente sem user_id)
  IF v_created_by IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Criar a notificação
  INSERT INTO client_notifications (network_id, title, message, created_by, sent_count)
  VALUES (p_network_id, p_title, p_message, v_created_by, 1)
  RETURNING id INTO v_notification_id;
  
  -- Criar o recipient
  INSERT INTO client_notification_recipients (notification_id, client_id)
  VALUES (v_notification_id, p_client_id);
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;