-- Adicionar campos de bônus de cadastro na tabela stores
ALTER TABLE public.stores 
ADD COLUMN signup_bonus_points numeric DEFAULT 0,
ADD COLUMN signup_bonus_cashback numeric DEFAULT 0;

COMMENT ON COLUMN public.stores.signup_bonus_points IS 'Pontos de bônus concedidos ao cliente no cadastro';
COMMENT ON COLUMN public.stores.signup_bonus_cashback IS 'Cashback de bônus concedido ao cliente no cadastro (em reais)';