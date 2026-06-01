-- Corrigir tipos de campanha existentes (remover prefixos)
UPDATE marketing_campaigns 
SET campaign_type = REPLACE(REPLACE(campaign_type, 'promocional_', ''), 'aniversario_', '')
WHERE campaign_type LIKE 'promocional_%' OR campaign_type LIKE 'aniversario_%';