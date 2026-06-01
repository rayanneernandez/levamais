-- Adicionar configurações de renovação nas redes
ALTER TABLE networks 
ADD COLUMN IF NOT EXISTS renewal_6_months_multiplier numeric DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS renewal_9_months_multiplier numeric DEFAULT 0.75,
ADD COLUMN IF NOT EXISTS renewal_12_months_multiplier numeric DEFAULT 1.0;

COMMENT ON COLUMN networks.renewal_6_months_multiplier IS 'Multiplicador de bônus para renovação de 6 meses';
COMMENT ON COLUMN networks.renewal_9_months_multiplier IS 'Multiplicador de bônus para renovação de 9 meses';
COMMENT ON COLUMN networks.renewal_12_months_multiplier IS 'Multiplicador de bônus para renovação de 12 meses';

-- Adicionar configuração de dias para alertar antes da expiração de pontos
ALTER TABLE networks
ADD COLUMN IF NOT EXISTS points_expiration_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS points_expiration_alert_days integer DEFAULT 7;

COMMENT ON COLUMN networks.points_expiration_days IS 'Dias para expiração de pontos/cashback após última transação';
COMMENT ON COLUMN networks.points_expiration_alert_days IS 'Dias antes da expiração para enviar alerta';