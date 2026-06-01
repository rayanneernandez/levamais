-- Adicionar colunas razao_social e nome_fantasia à tabela stores
ALTER TABLE public.stores 
ADD COLUMN razao_social TEXT,
ADD COLUMN nome_fantasia TEXT;