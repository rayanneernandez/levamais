-- Etapa 2: Adicionar campos de contrato e CNPJs à tabela networks

-- Adicionar campo para data de início do contrato
ALTER TABLE networks 
ADD COLUMN IF NOT EXISTS contract_start_date date;

-- Adicionar campo para data de término do contrato
ALTER TABLE networks 
ADD COLUMN IF NOT EXISTS contract_end_date date;

-- Adicionar campo para armazenar todos os CNPJs da proposta
ALTER TABLE networks 
ADD COLUMN IF NOT EXISTS cnpjs text[];

COMMENT ON COLUMN networks.contract_start_date IS 'Data de início do contrato (data da aprovação do orçamento)';
COMMENT ON COLUMN networks.contract_end_date IS 'Data de término do contrato (12 meses após início ou conforme contract_duration_months)';
COMMENT ON COLUMN networks.cnpjs IS 'Array com todos os CNPJs incluídos na proposta comercial';