-- Adicionar coluna para controlar se o cliente já viu o tutorial
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN DEFAULT FALSE;