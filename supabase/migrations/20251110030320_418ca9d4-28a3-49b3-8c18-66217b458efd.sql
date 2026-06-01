-- Corrigir constraint do billing_day para aceitar apenas 5, 10 ou 20

-- Remover constraint antiga se existir
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_billing_day_check;
ALTER TABLE networks DROP CONSTRAINT IF EXISTS networks_billing_day_check;

-- Adicionar nova constraint permitindo apenas 5, 10 ou 20
ALTER TABLE budgets 
ADD CONSTRAINT budgets_billing_day_check CHECK (billing_day IN (5, 10, 20));

ALTER TABLE networks 
ADD CONSTRAINT networks_billing_day_check CHECK (billing_day IN (5, 10, 20));

-- Atualizar comentários
COMMENT ON COLUMN budgets.billing_day IS 'Dia de vencimento das cobranças mensais (opções: 5, 10 ou 20)';
COMMENT ON COLUMN networks.billing_day IS 'Dia de vencimento das cobranças mensais (opções: 5, 10 ou 20)';