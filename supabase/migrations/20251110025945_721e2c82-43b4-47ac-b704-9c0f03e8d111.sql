-- Adicionar campos de faturamento à tabela networks

-- Adicionar campo para dia de vencimento (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'networks' AND column_name = 'billing_day') THEN
    ALTER TABLE networks ADD COLUMN billing_day integer;
  END IF;
END $$;

-- Adicionar campo para tipo de faturamento
ALTER TABLE networks 
ADD COLUMN IF NOT EXISTS billing_type text CHECK (billing_type IN ('per_cnpj', 'single_cnpj'));

-- Adicionar campo para CNPJ principal quando faturamento for único
ALTER TABLE networks 
ADD COLUMN IF NOT EXISTS main_billing_cnpj text;

COMMENT ON COLUMN networks.billing_day IS 'Dia do mês escolhido para vencimento das cobranças (1-28)';
COMMENT ON COLUMN networks.billing_type IS 'Tipo de faturamento: per_cnpj (um boleto por CNPJ) ou single_cnpj (único boleto consolidado)';
COMMENT ON COLUMN networks.main_billing_cnpj IS 'CNPJ principal quando billing_type = single_cnpj';