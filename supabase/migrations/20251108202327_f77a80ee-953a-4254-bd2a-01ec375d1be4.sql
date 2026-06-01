-- Adicionar coluna de status aos resgates
ALTER TABLE public.one_promotion_redemptions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'resgatado' CHECK (status IN ('solicitado', 'resgatado', 'cancelado'));

-- Atualizar resgates existentes para 'resgatado'
UPDATE public.one_promotion_redemptions 
SET status = 'resgatado' 
WHERE status IS NULL;

-- Adicionar comentário
COMMENT ON COLUMN public.one_promotion_redemptions.status IS 'Status do resgate: solicitado, resgatado ou cancelado';