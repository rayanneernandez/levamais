-- Permitir user_id nulo na tabela clients (clientes pré-cadastrados ainda não registrados)
ALTER TABLE public.clients
ALTER COLUMN user_id DROP NOT NULL;

-- Adicionar índice para user_id para melhorar performance
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id) WHERE user_id IS NOT NULL;