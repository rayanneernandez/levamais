-- Adicionar campos para assinatura da BISW Solutions
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS bisw_approved_by_name TEXT,
ADD COLUMN IF NOT EXISTS bisw_approved_by_cpf TEXT,
ADD COLUMN IF NOT EXISTS bisw_approved_by_email TEXT,
ADD COLUMN IF NOT EXISTS bisw_approved_by_position TEXT,
ADD COLUMN IF NOT EXISTS bisw_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS bisw_approval_signature TEXT,
ADD COLUMN IF NOT EXISTS bisw_approval_document_hash TEXT,
ADD COLUMN IF NOT EXISTS bisw_approval_ip TEXT,
ADD COLUMN IF NOT EXISTS bisw_approval_user_agent TEXT,
ADD COLUMN IF NOT EXISTS bisw_approval_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS bisw_approval_longitude DECIMAL(11, 8);

COMMENT ON COLUMN public.budgets.bisw_approved_by_name IS 'Nome do representante da BISW que assinou';
COMMENT ON COLUMN public.budgets.bisw_approved_by_cpf IS 'CPF do representante da BISW';
COMMENT ON COLUMN public.budgets.bisw_approved_by_email IS 'Email do representante da BISW';
COMMENT ON COLUMN public.budgets.bisw_approved_by_position IS 'Cargo do representante da BISW';
COMMENT ON COLUMN public.budgets.bisw_approved_at IS 'Data/hora da assinatura da BISW';
COMMENT ON COLUMN public.budgets.bisw_approval_signature IS 'Hash da assinatura digital da BISW';
COMMENT ON COLUMN public.budgets.bisw_approval_document_hash IS 'Hash do documento na assinatura da BISW';
COMMENT ON COLUMN public.budgets.bisw_approval_ip IS 'IP da assinatura da BISW';
COMMENT ON COLUMN public.budgets.bisw_approval_latitude IS 'Latitude da geolocalização da assinatura da BISW';
COMMENT ON COLUMN public.budgets.bisw_approval_longitude IS 'Longitude da geolocalização da assinatura da BISW';