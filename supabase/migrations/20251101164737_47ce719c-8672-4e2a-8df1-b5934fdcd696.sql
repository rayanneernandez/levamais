-- Simplificar licenças de combustível
-- Remover location_cep
ALTER TABLE public.networks DROP COLUMN IF EXISTS location_cep;

-- Adicionar location_estado para licença de estado
ALTER TABLE public.networks ADD COLUMN IF NOT EXISTS location_estado TEXT;

-- Comentário: fuel_analysis_scope já existe, apenas vamos usar "estado" ou "brasil"