-- Remove a constraint UNIQUE global do CPF
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_cpf_key;

-- Cria uma constraint UNIQUE composta (cpf + network_id)
-- Isso permite o mesmo CPF em redes diferentes, mas garante unicidade dentro da mesma rede
ALTER TABLE public.clients 
ADD CONSTRAINT clients_cpf_network_id_key UNIQUE (cpf, network_id);