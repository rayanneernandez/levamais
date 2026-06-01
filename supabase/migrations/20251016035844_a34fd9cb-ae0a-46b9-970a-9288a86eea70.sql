-- Adicionar coluna para tipo de ação (cashback ou pontos)
ALTER TABLE public.cashback_campaigns 
ADD COLUMN action_type TEXT NOT NULL DEFAULT 'cashback' CHECK (action_type IN ('cashback', 'points'));

-- Renomear a tabela para um nome mais genérico
ALTER TABLE public.cashback_campaigns RENAME TO loyalty_campaigns;

-- Atualizar constraint name references
ALTER TABLE public.campaign_stores 
DROP CONSTRAINT campaign_stores_campaign_id_fkey;

ALTER TABLE public.campaign_stores 
ADD CONSTRAINT campaign_stores_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES public.loyalty_campaigns(id) ON DELETE CASCADE;

-- Adicionar coluna para multiplicador de pontos
ALTER TABLE public.loyalty_campaigns 
ADD COLUMN points_multiplier NUMERIC DEFAULT 1;