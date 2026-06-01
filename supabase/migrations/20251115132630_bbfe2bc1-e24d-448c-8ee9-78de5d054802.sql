-- Adicionar campos de reply nas avaliações NPS
ALTER TABLE public.transaction_ratings 
ADD COLUMN IF NOT EXISTS store_reply TEXT,
ADD COLUMN IF NOT EXISTS reply_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS replied_by UUID REFERENCES auth.users(id);

-- Adicionar índice para buscar avaliações respondidas
CREATE INDEX IF NOT EXISTS idx_transaction_ratings_replied 
ON public.transaction_ratings(replied_by, reply_at) 
WHERE store_reply IS NOT NULL;