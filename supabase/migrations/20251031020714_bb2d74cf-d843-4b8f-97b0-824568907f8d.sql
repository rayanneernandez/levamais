-- Adicionar campos de crédito de IA na tabela networks
ALTER TABLE public.networks 
ADD COLUMN ai_credits_limit integer DEFAULT 0,
ADD COLUMN ai_credits_used integer DEFAULT 0,
ADD COLUMN ai_credits_price numeric DEFAULT 0;

COMMENT ON COLUMN public.networks.ai_credits_limit IS 'Limite de créditos de IA contratados (50, 100, 200, 300, 500, 1000)';
COMMENT ON COLUMN public.networks.ai_credits_used IS 'Créditos de IA já utilizados';
COMMENT ON COLUMN public.networks.ai_credits_price IS 'Preço mensal do pacote de créditos de IA';