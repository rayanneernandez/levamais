-- Adicionar campos para permitir outros custos em valor fixo ou percentual
ALTER TABLE one_operational_costs 
ADD COLUMN IF NOT EXISTS other_costs_type text DEFAULT 'percentage' CHECK (other_costs_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS other_costs_fixed_value numeric DEFAULT 0;

-- Atualizar comentários das colunas
COMMENT ON COLUMN one_operational_costs.other_costs_type IS 'Tipo de cálculo: percentage (%) ou fixed (R$)';
COMMENT ON COLUMN one_operational_costs.other_costs_percentage IS 'Percentual de outros custos (usado quando type = percentage)';
COMMENT ON COLUMN one_operational_costs.other_costs_fixed_value IS 'Valor fixo de outros custos em R$ (usado quando type = fixed)';