-- Adicionar campo para habilitar resgate automático
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS auto_redemption_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clients.auto_redemption_enabled IS 
'Quando ativado, o PDV do webPosto vai resgatar automaticamente quando o saldo estiver acima do mínimo';