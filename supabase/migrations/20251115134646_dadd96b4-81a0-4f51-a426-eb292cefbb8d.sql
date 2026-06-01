-- Função helper para criar notificações para clientes
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
BEGIN
  -- Criar a notificação
  INSERT INTO client_notifications (network_id, title, message, created_by, sent_count)
  VALUES (p_network_id, p_title, p_message, p_created_by, 1)
  RETURNING id INTO v_notification_id;
  
  -- Criar o recipient
  INSERT INTO client_notification_recipients (notification_id, client_id)
  VALUES (v_notification_id, p_client_id);
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificar acúmulo de pontos
CREATE OR REPLACE FUNCTION notify_transaction_accumulation()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas para transações de acúmulo com pontos positivos
  IF NEW.type = 'accumulation' AND NEW.points > 0 THEN
    PERFORM create_client_notification(
      NEW.client_id,
      NEW.network_id,
      '🎉 Pontos Acumulados!',
      format('Você acumulou %s pontos em %s. Total: %s pontos', 
        ROUND(NEW.points, 2)::TEXT, 
        (SELECT name FROM stores WHERE id = NEW.store_id LIMIT 1),
        ROUND((SELECT total_points FROM clients WHERE id = NEW.client_id), 2)::TEXT
      ),
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_transaction_accumulation ON transactions;
CREATE TRIGGER trigger_notify_transaction_accumulation
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION notify_transaction_accumulation();

-- Trigger para notificar resgates
CREATE OR REPLACE FUNCTION notify_transaction_redemption()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas para transações de resgate
  IF NEW.type = 'redemption' THEN
    PERFORM create_client_notification(
      NEW.client_id,
      NEW.network_id,
      '💰 Resgate Realizado!',
      format('Você resgatou %s pontos em %s. Saldo restante: %s pontos', 
        ABS(ROUND(NEW.points, 2))::TEXT,
        (SELECT name FROM stores WHERE id = NEW.store_id LIMIT 1),
        ROUND((SELECT total_points FROM clients WHERE id = NEW.client_id), 2)::TEXT
      ),
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_transaction_redemption ON transactions;
CREATE TRIGGER trigger_notify_transaction_redemption
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION notify_transaction_redemption();

-- Trigger para notificar quando promoções são aplicadas
CREATE OR REPLACE FUNCTION notify_one_promotion_redemption()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_network_id UUID;
  v_promotion_name TEXT;
BEGIN
  -- Buscar informações da transação
  SELECT t.client_id, t.network_id INTO v_client_id, v_network_id
  FROM transactions t
  WHERE t.id = NEW.transaction_id;
  
  -- Buscar nome da promoção
  SELECT title INTO v_promotion_name
  FROM one_promotions
  WHERE id = NEW.promotion_id;
  
  IF v_client_id IS NOT NULL AND v_network_id IS NOT NULL THEN
    PERFORM create_client_notification(
      v_client_id,
      v_network_id,
      '🎁 Promoção Aplicada!',
      format('A promoção "%s" foi aplicada no seu resgate!', v_promotion_name),
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_one_promotion_redemption ON one_promotion_redemptions;
CREATE TRIGGER trigger_notify_one_promotion_redemption
AFTER INSERT ON one_promotion_redemptions
FOR EACH ROW
EXECUTE FUNCTION notify_one_promotion_redemption();