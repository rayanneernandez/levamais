-- Adicionar suporte para status 'timeout' na tabela webposto_transactions
-- Manter como TEXT para compatibilidade com código existente

-- Criar índice para melhorar performance das buscas por status e data
CREATE INDEX IF NOT EXISTS idx_webposto_transactions_status_created 
ON public.webposto_transactions(status, created_at);

-- Adicionar constraint de validação para aceitar os valores corretos
ALTER TABLE public.webposto_transactions 
DROP CONSTRAINT IF EXISTS webposto_transactions_status_check;

ALTER TABLE public.webposto_transactions 
ADD CONSTRAINT webposto_transactions_status_check 
CHECK (status IN ('pending', 'confirmed', 'cancelled', 'timeout'));

-- Comentário explicativo
COMMENT ON COLUMN public.webposto_transactions.status IS 
'Status da transação: pending (aguardando confirmação), confirmed (confirmada), cancelled (cancelada), timeout (expirada por falta de confirmação)';
