-- Remover a constraint única global do CPF
-- A constraint composta (cpf, network_id) já garante que não haverá duplicatas dentro da mesma rede
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_cpf_unique;

-- Adicionar índice para melhorar performance de buscas por CPF
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf);

-- Comentário explicativo
COMMENT ON COLUMN public.clients.cpf IS 
'CPF do cliente. Pode se repetir em diferentes redes, mas é único dentro da mesma rede através da constraint clients_cpf_network_id_key';
