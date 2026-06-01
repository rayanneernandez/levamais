-- Remover tabelas de referência geográfica
DROP TABLE IF EXISTS public.br_municipios CASCADE;
DROP TABLE IF EXISTS public.br_cidades CASCADE;
DROP TABLE IF EXISTS public.br_estados CASCADE;

-- Remover colunas antigas de localização da tabela networks
ALTER TABLE public.networks 
  DROP COLUMN IF EXISTS location_estado,
  DROP COLUMN IF EXISTS location_cidade,
  DROP COLUMN IF EXISTS location_municipio;

-- Adicionar coluna de CEP
ALTER TABLE public.networks 
  ADD COLUMN IF NOT EXISTS location_cep TEXT;