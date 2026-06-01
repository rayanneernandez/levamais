-- Adicionar coluna location_type na tabela one_promotions
-- Define onde a promoção pode ser resgatada: 'pista' (posto), 'loja' (conveniência) ou 'ambos'
ALTER TABLE public.one_promotions
ADD COLUMN location_type TEXT DEFAULT 'ambos' CHECK (location_type IN ('pista', 'loja', 'ambos'));

-- Atualizar promoções existentes para 'ambos'
UPDATE public.one_promotions
SET location_type = 'ambos'
WHERE location_type IS NULL;