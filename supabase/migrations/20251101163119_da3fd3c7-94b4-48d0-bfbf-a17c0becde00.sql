-- Adicionar coluna cidade na tabela fuel_prices
ALTER TABLE fuel_prices ADD COLUMN IF NOT EXISTS cidade TEXT;

-- Criar índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_fuel_prices_cidade ON fuel_prices(cidade);
CREATE INDEX IF NOT EXISTS idx_fuel_prices_estado_cidade ON fuel_prices(estado, cidade);
CREATE INDEX IF NOT EXISTS idx_fuel_prices_estado_cidade_municipio ON fuel_prices(estado, cidade, municipio);