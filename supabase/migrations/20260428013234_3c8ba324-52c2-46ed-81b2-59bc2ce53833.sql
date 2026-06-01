-- Adicionar colunas de soft delete em store_managers
ALTER TABLE public.store_managers
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid;

-- Índice para filtrar usuários ativos/inativos rapidamente
CREATE INDEX IF NOT EXISTS idx_store_managers_is_active 
  ON public.store_managers(network_id, is_active) 
  WHERE store_id IS NULL;