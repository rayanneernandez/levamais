-- Add location fields to networks table for fuel analysis scope
ALTER TABLE networks 
ADD COLUMN IF NOT EXISTS location_municipio TEXT,
ADD COLUMN IF NOT EXISTS location_cidade TEXT,
ADD COLUMN IF NOT EXISTS location_estado TEXT;

COMMENT ON COLUMN networks.location_municipio IS 'Município para escopo de análise de combustível';
COMMENT ON COLUMN networks.location_cidade IS 'Cidade para escopo de análise de combustível';
COMMENT ON COLUMN networks.location_estado IS 'Estado para escopo de análise de combustível';