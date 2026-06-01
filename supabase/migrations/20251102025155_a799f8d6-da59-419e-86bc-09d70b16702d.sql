-- Adicionar colunas para código e nome do colaborador/atendente na tabela webposto_transactions
ALTER TABLE public.webposto_transactions 
ADD COLUMN codigo_colaborador TEXT,
ADD COLUMN nome_colaborador TEXT;