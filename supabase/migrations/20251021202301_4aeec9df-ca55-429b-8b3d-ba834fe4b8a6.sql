-- Criar índice para melhorar performance das buscas por status e data
CREATE INDEX IF NOT EXISTS idx_webposto_transactions_status_created 
ON public.webposto_transactions(status, created_at);

-- Comentário explicativo
COMMENT ON COLUMN public.webposto_transactions.status IS 
'Status da transação: pending (aguardando confirmação), confirmed (confirmada), cancelled (cancelada), timeout (expirada por falta de confirmação)';
