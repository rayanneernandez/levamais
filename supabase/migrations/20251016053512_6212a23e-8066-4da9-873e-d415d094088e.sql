-- Adicionar configuração de limite de resgate 24h
ALTER TABLE public.stores 
ADD COLUMN enable_redemption_limit_24h boolean DEFAULT true;

COMMENT ON COLUMN public.stores.enable_redemption_limit_24h IS 'Limita resgates a 1 por cliente a cada 24 horas';