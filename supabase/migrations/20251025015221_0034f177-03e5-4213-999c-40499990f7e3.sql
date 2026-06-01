-- Adicionar campos de configuração de indicação na tabela networks
ALTER TABLE networks
ADD COLUMN IF NOT EXISTS referral_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS referral_bonus_type text DEFAULT 'cashback' CHECK (referral_bonus_type IN ('cashback', 'points')),
ADD COLUMN IF NOT EXISTS referral_bonus_referrer numeric DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS referral_bonus_referred numeric DEFAULT 10.00;

-- Criar tabela para rastrear indicações com limite
CREATE TABLE IF NOT EXISTS client_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  referred_client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  network_id uuid NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  bonus_applied boolean DEFAULT false,
  bonus_type text NOT NULL CHECK (bonus_type IN ('cashback', 'points')),
  referrer_bonus_amount numeric NOT NULL,
  referred_bonus_amount numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(referrer_client_id, referred_client_id)
);

-- Habilitar RLS
ALTER TABLE client_referrals ENABLE ROW LEVEL SECURITY;

-- Políticas para client_referrals
CREATE POLICY "Clients can view own referrals"
ON client_referrals FOR SELECT
USING (
  referrer_client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  OR referred_client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);

CREATE POLICY "System can create referrals"
ON client_referrals FOR INSERT
WITH CHECK (true);

CREATE POLICY "Network managers can view network referrals"
ON client_referrals FOR SELECT
USING (
  has_role(auth.uid(), 'network_manager') 
  AND network_id = get_user_network_id(auth.uid())
);

-- Função para contar indicações ativas de um cliente
CREATE OR REPLACE FUNCTION get_client_referral_count(client_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM client_referrals
    WHERE referrer_client_id = client_uuid
  );
END;
$$;

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_client_referrals_referrer ON client_referrals(referrer_client_id);
CREATE INDEX IF NOT EXISTS idx_client_referrals_referred ON client_referrals(referrer_client_id);
CREATE INDEX IF NOT EXISTS idx_client_referrals_network ON client_referrals(network_id);