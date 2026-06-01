-- Corrigir função de notificação de acúmulo de pontos
CREATE OR REPLACE FUNCTION notify_transaction_accumulation()
RETURNS TRIGGER AS $$
DECLARE
  v_network_id UUID;
  v_store_name TEXT;
  v_total_points NUMERIC;
BEGIN
  -- Apenas para transações de acúmulo com pontos positivos
  IF NEW.type = 'accumulation' AND NEW.points > 0 THEN
    -- Buscar network_id e nome da loja
    SELECT s.network_id, s.name INTO v_network_id, v_store_name
    FROM stores s
    WHERE s.id = NEW.store_id;
    
    -- Buscar total de pontos do cliente
    SELECT total_points INTO v_total_points
    FROM clients
    WHERE id = NEW.client_id;
    
    IF v_network_id IS NOT NULL THEN
      PERFORM create_client_notification(
        NEW.client_id,
        v_network_id,
        '🎉 Pontos Acumulados!',
        format('Você acumulou %s pontos em %s. Total: %s pontos', 
          ROUND(NEW.points, 2)::TEXT, 
          COALESCE(v_store_name, 'loja'),
          ROUND(COALESCE(v_total_points, 0), 2)::TEXT
        ),
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Corrigir função de notificação de resgate
CREATE OR REPLACE FUNCTION notify_transaction_redemption()
RETURNS TRIGGER AS $$
DECLARE
  v_network_id UUID;
  v_store_name TEXT;
  v_total_points NUMERIC;
BEGIN
  -- Apenas para transações de resgate
  IF NEW.type = 'redemption' THEN
    -- Buscar network_id e nome da loja
    SELECT s.network_id, s.name INTO v_network_id, v_store_name
    FROM stores s
    WHERE s.id = NEW.store_id;
    
    -- Buscar total de pontos do cliente
    SELECT total_points INTO v_total_points
    FROM clients
    WHERE id = NEW.client_id;
    
    IF v_network_id IS NOT NULL THEN
      PERFORM create_client_notification(
        NEW.client_id,
        v_network_id,
        '💰 Resgate Realizado!',
        format('Você resgatou %s pontos em %s. Saldo restante: %s pontos', 
          ABS(ROUND(NEW.points, 2))::TEXT,
          COALESCE(v_store_name, 'loja'),
          ROUND(COALESCE(v_total_points, 0), 2)::TEXT
        ),
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;