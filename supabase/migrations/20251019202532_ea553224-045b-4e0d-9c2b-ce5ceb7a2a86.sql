-- Adicionar campos de implantação na tabela networks
ALTER TABLE public.networks
ADD COLUMN valor_implantacao NUMERIC,
ADD COLUMN implantado BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.networks.valor_implantacao IS 'Valor único da implantação da rede';
COMMENT ON COLUMN public.networks.implantado IS 'Indica se a implantação já foi realizada e cobrada';