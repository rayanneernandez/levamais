-- Adicionar campos de contratos e multas nas networks
ALTER TABLE public.networks
ADD COLUMN IF NOT EXISTS contract_start_date DATE,
ADD COLUMN IF NOT EXISTS contract_end_date DATE,
ADD COLUMN IF NOT EXISTS contract_duration_months INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS poc_days INTEGER,
ADD COLUMN IF NOT EXISTS cancellation_penalty_percentage NUMERIC DEFAULT 50,
ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'active' CHECK (contract_status IN ('active', 'cancelled', 'expired'));

-- Adicionar campos relacionados a contrato nos budgets
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS contract_duration_months INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS poc_days INTEGER;

-- Adicionar campo para tracking de multas nas asaas_charges
ALTER TABLE public.asaas_charges
ADD COLUMN IF NOT EXISTS is_penalty BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS penalty_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS original_contract_end_date DATE;

COMMENT ON COLUMN public.networks.contract_start_date IS 'Data de início do contrato';
COMMENT ON COLUMN public.networks.contract_end_date IS 'Data de término do contrato (12 meses após início)';
COMMENT ON COLUMN public.networks.contract_duration_months IS 'Duração do contrato em meses (padrão: 12)';
COMMENT ON COLUMN public.networks.poc_days IS 'Período de POC (Proof of Concept) em dias (15 ou 30)';
COMMENT ON COLUMN public.networks.cancellation_penalty_percentage IS 'Percentual da multa rescisória (padrão: 50%)';
COMMENT ON COLUMN public.networks.contract_status IS 'Status do contrato: active, cancelled, expired';

COMMENT ON COLUMN public.asaas_charges.is_penalty IS 'Indica se a cobrança é uma multa rescisória';
COMMENT ON COLUMN public.asaas_charges.penalty_percentage IS 'Percentual da multa aplicada';
COMMENT ON COLUMN public.asaas_charges.original_contract_end_date IS 'Data original de término do contrato antes do cancelamento';