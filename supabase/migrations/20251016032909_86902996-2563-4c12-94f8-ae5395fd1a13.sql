-- Adicionar campos para configuração de cashback e conversão de pontos
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS real_per_point numeric DEFAULT 0.01,
ADD COLUMN IF NOT EXISTS cashback_type text DEFAULT 'percentage' CHECK (cashback_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS cashback_fixed_value numeric DEFAULT 0.10;

COMMENT ON COLUMN public.stores.real_per_point IS 'Quantos reais vale cada ponto ao trocar';
COMMENT ON COLUMN public.stores.cashback_type IS 'Tipo de cashback: percentage (percentual) ou fixed (valor fixo por real)';
COMMENT ON COLUMN public.stores.cashback_fixed_value IS 'Valor fixo de cashback por real gasto (usado quando cashback_type = fixed)';