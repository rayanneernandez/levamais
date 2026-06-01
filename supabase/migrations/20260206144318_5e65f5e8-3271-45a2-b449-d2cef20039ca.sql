-- Adicionar campo para habilitar/desabilitar Leva+ One na rede
ALTER TABLE public.networks 
ADD COLUMN IF NOT EXISTS one_enabled BOOLEAN NOT NULL DEFAULT false;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.networks.one_enabled IS 'Indica se a rede oferece o programa Leva+ One para seus clientes';