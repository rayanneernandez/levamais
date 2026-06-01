-- Adicionar campos para armazenar dados do cupom fiscal na transação
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS nfce_access_key TEXT,
ADD COLUMN IF NOT EXISTS nfce_cnpj TEXT,
ADD COLUMN IF NOT EXISTS nfce_emitter_name TEXT;

-- Índice para buscar transações por chave de acesso (evitar duplicação)
CREATE INDEX IF NOT EXISTS idx_transactions_nfce_access_key ON public.transactions(nfce_access_key) WHERE nfce_access_key IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.transactions.nfce_access_key IS 'Chave de acesso de 44 dígitos do cupom fiscal (NFC-e/NF-e)';
COMMENT ON COLUMN public.transactions.nfce_cnpj IS 'CNPJ do estabelecimento emissor do cupom fiscal';
COMMENT ON COLUMN public.transactions.nfce_emitter_name IS 'Nome/Razão social do estabelecimento emissor';