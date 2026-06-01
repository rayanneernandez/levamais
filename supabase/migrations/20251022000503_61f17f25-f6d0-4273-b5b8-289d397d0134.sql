-- ============================================
-- FASE 1: PROGRAMA DE RETENÇÃO DE CLIENTES
-- ============================================

-- 1.1 - Tabela de configuração de retenção por rede
CREATE TABLE IF NOT EXISTS network_retention_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- Multiplicadores para CASHBACK (em percentual, ex: 10 = 10%)
  cashback_multiplier_6_months NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  cashback_multiplier_9_months NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  cashback_multiplier_12_months NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  
  -- Multiplicadores para PONTOS (em percentual, ex: 10 = 10%)
  points_multiplier_6_months NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  points_multiplier_9_months NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  points_multiplier_12_months NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_network_retention_config_network ON network_retention_config(network_id);
CREATE INDEX IF NOT EXISTS idx_network_retention_config_active ON network_retention_config(is_active);

-- 1.2 - Tabela de compromissos de retenção dos clientes
CREATE TABLE IF NOT EXISTS client_retention_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  
  -- Período escolhido
  commitment_months INTEGER NOT NULL CHECK (commitment_months IN (6, 9, 12)),
  multiplier_applied NUMERIC(5,2) NOT NULL,
  loyalty_type TEXT NOT NULL CHECK (loyalty_type IN ('cashback', 'points')),
  
  -- Datas
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'upgraded')),
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Email de expiração enviado
  expiration_email_sent BOOLEAN NOT NULL DEFAULT false
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_client_retention_client ON client_retention_commitments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_retention_network ON client_retention_commitments(network_id);
CREATE INDEX IF NOT EXISTS idx_client_retention_status ON client_retention_commitments(status);
CREATE INDEX IF NOT EXISTS idx_client_retention_expires ON client_retention_commitments(expires_at);

-- Constraint: Cliente só pode ter 1 compromisso ativo por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_one_active_commitment 
ON client_retention_commitments(client_id) 
WHERE status = 'active';

-- 1.3 - Atualizar função can_change_favorite_network para considerar retenção
CREATE OR REPLACE FUNCTION can_change_favorite_network(client_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  last_change timestamp with time zone;
  has_active_commitment boolean;
BEGIN
  -- Verificar se há compromisso ativo
  SELECT EXISTS (
    SELECT 1 
    FROM client_retention_commitments
    WHERE client_id = client_uuid 
      AND status = 'active'
      AND expires_at > now()
  ) INTO has_active_commitment;
  
  -- Se há compromisso ativo, NÃO pode trocar
  IF has_active_commitment THEN
    RETURN false;
  END IF;
  
  -- Verificação original de 90 dias
  SELECT favorite_network_changed_at INTO last_change
  FROM clients
  WHERE id = client_uuid;
  
  RETURN last_change IS NULL OR (now() - last_change) >= interval '90 days';
END;
$$;

-- 1.4 - Função para obter multiplicador ativo do cliente
CREATE OR REPLACE FUNCTION get_client_active_retention_multiplier(
  client_uuid uuid,
  network_uuid uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  multiplier numeric;
BEGIN
  SELECT multiplier_applied INTO multiplier
  FROM client_retention_commitments
  WHERE client_id = client_uuid
    AND network_id = network_uuid
    AND status = 'active'
    AND expires_at > now()
  LIMIT 1;
  
  -- Retorna 0 se não houver compromisso ativo (sem bônus)
  RETURN COALESCE(multiplier, 0);
END;
$$;

-- 1.5 - Função para obter data de expiração do compromisso
CREATE OR REPLACE FUNCTION get_commitment_expiration_date(client_uuid uuid)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expiration_date timestamp with time zone;
BEGIN
  SELECT expires_at INTO expiration_date
  FROM client_retention_commitments
  WHERE client_id = client_uuid
    AND status = 'active'
  LIMIT 1;
  
  RETURN expiration_date;
END;
$$;

-- 1.6 - RLS Policies para network_retention_config
ALTER TABLE network_retention_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Network managers can manage own retention config" ON network_retention_config;
CREATE POLICY "Network managers can manage own retention config"
  ON network_retention_config
  FOR ALL
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage all retention configs" ON network_retention_config;
CREATE POLICY "Admins can manage all retention configs"
  ON network_retention_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Clients can view network retention config" ON network_retention_config;
CREATE POLICY "Clients can view network retention config"
  ON network_retention_config
  FOR SELECT
  USING (
    is_active = true 
    AND network_id IN (
      SELECT network_id FROM clients WHERE user_id = auth.uid()
    )
  );

-- 1.7 - RLS Policies para client_retention_commitments
ALTER TABLE client_retention_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own commitments" ON client_retention_commitments;
CREATE POLICY "Clients can view own commitments"
  ON client_retention_commitments
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients can create own commitments" ON client_retention_commitments;
CREATE POLICY "Clients can create own commitments"
  ON client_retention_commitments
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Network managers can view own network commitments" ON client_retention_commitments;
CREATE POLICY "Network managers can view own network commitments"
  ON client_retention_commitments
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role)
    AND network_id = get_user_network_id(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage all commitments" ON client_retention_commitments;
CREATE POLICY "Admins can manage all commitments"
  ON client_retention_commitments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));