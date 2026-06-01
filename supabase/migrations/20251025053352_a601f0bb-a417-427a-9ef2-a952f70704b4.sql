-- Permitir que network_id seja NULL na tabela budgets
ALTER TABLE public.budgets 
ALTER COLUMN network_id DROP NOT NULL;