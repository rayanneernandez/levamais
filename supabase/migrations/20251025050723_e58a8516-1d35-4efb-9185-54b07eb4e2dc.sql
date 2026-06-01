-- Adicionar coluna para indicar se o serviço é recorrente
ALTER TABLE products_services 
ADD COLUMN is_recurring boolean DEFAULT false;

COMMENT ON COLUMN products_services.is_recurring IS 'Indica se o serviço é recorrente (mensalidade) ou único';