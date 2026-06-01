-- Remover a constraint única de user_id na tabela clients
-- Isso permite que um usuário tenha múltiplos registros em diferentes redes
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_user_id_key;

-- Criar índice não-único para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id) WHERE user_id IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.clients.user_id IS 
'ID do usuário autenticado. Pode se repetir quando o cliente está em múltiplas redes. Buscar sempre por user_id para pegar todos os registros do cliente.';
