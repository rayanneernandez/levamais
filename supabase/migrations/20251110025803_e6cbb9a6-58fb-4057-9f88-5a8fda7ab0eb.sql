-- Etapa 1: Adicionar campos de faturamento ao orçamento

-- Adicionar campo para dia de vencimento escolhido pelo cliente
ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS billing_day integer;

-- Adicionar campo para tipo de faturamento (por CNPJ ou único)
ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS billing_type text CHECK (billing_type IN ('per_cnpj', 'single_cnpj'));

-- Adicionar campo para CNPJ principal quando faturamento for único
ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS main_billing_cnpj text;

COMMENT ON COLUMN budgets.billing_day IS 'Dia do mês escolhido pelo cliente para vencimento das cobranças (1-28)';
COMMENT ON COLUMN budgets.billing_type IS 'Tipo de faturamento: per_cnpj (um boleto por CNPJ) ou single_cnpj (único boleto consolidado)';
COMMENT ON COLUMN budgets.main_billing_cnpj IS 'CNPJ principal quando billing_type = single_cnpj';