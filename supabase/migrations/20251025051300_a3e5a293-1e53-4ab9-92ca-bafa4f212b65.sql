-- Adicionar colunas de desconto na tabela budget_items
ALTER TABLE budget_items 
ADD COLUMN discount_type text CHECK (discount_type IN ('percentage', 'value')),
ADD COLUMN discount_amount numeric(10,2),
ADD COLUMN unit_value_with_discount numeric(10,2);

COMMENT ON COLUMN budget_items.discount_type IS 'Tipo de desconto: percentage (%) ou value (R$)';
COMMENT ON COLUMN budget_items.discount_amount IS 'Valor do desconto (percentual ou valor)';
COMMENT ON COLUMN budget_items.unit_value_with_discount IS 'Valor unitário após aplicar desconto';