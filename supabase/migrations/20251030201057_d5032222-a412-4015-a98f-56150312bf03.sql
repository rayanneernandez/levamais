-- Adicionar configuração de prazo para resgate após acúmulo
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS redemption_time_delay_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS redemption_time_delay_value integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS redemption_time_delay_unit text DEFAULT 'immediate' CHECK (redemption_time_delay_unit IN ('immediate', 'hours', 'days'));

COMMENT ON COLUMN public.stores.redemption_time_delay_enabled IS 'Se ativado, clientes precisam esperar um tempo após acumular para resgatar';
COMMENT ON COLUMN public.stores.redemption_time_delay_value IS 'Valor do tempo de espera (em horas ou dias)';
COMMENT ON COLUMN public.stores.redemption_time_delay_unit IS 'Unidade de tempo: immediate (sem espera), hours (horas) ou days (dias)';