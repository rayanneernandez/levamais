-- Adicionar campos de limites de resgate e trava de acúmulo
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS min_redeem_cashback numeric DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS max_redeem_cashback numeric DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS min_redeem_points numeric DEFAULT 100,
ADD COLUMN IF NOT EXISTS max_redeem_points numeric DEFAULT 10000,
ADD COLUMN IF NOT EXISTS block_accumulation_cashback_limit numeric DEFAULT 500.00,
ADD COLUMN IF NOT EXISTS block_accumulation_points_limit numeric DEFAULT 50000,
ADD COLUMN IF NOT EXISTS enable_cashback_accumulation_block boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_points_accumulation_block boolean DEFAULT false;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.stores.min_redeem_cashback IS 'Valor mínimo em R$ para resgate de cashback';
COMMENT ON COLUMN public.stores.max_redeem_cashback IS 'Valor máximo em R$ para resgate de cashback';
COMMENT ON COLUMN public.stores.min_redeem_points IS 'Quantidade mínima de pontos para resgate';
COMMENT ON COLUMN public.stores.max_redeem_points IS 'Quantidade máxima de pontos para resgate';
COMMENT ON COLUMN public.stores.block_accumulation_cashback_limit IS 'Valor em R$ que trava novas acumulações de cashback';
COMMENT ON COLUMN public.stores.block_accumulation_points_limit IS 'Pontos que travam novas acumulações';
COMMENT ON COLUMN public.stores.enable_cashback_accumulation_block IS 'Habilita bloqueio de acúmulo ao atingir limite de cashback';
COMMENT ON COLUMN public.stores.enable_points_accumulation_block IS 'Habilita bloqueio de acúmulo ao atingir limite de pontos';