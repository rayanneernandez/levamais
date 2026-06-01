-- Adicionar campos de licenciamento na tabela networks
ALTER TABLE public.networks 
ADD COLUMN monthly_fee NUMERIC(10,2),
ADD COLUMN billing_day INTEGER CHECK (billing_day IN (5, 10, 20)),
ADD COLUMN max_stores INTEGER DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN public.networks.monthly_fee IS 'Valor da mensalidade da licença';
COMMENT ON COLUMN public.networks.billing_day IS 'Dia de cobrança mensal (5, 10 ou 20)';
COMMENT ON COLUMN public.networks.max_stores IS 'Quantidade máxima de lojas que a rede pode cadastrar';