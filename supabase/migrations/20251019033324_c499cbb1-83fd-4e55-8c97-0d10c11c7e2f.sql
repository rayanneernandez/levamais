-- Adicionar configuração de acúmulo durante resgate
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'redemption_accumulation_type') THEN
    CREATE TYPE redemption_accumulation_type AS ENUM ('none', 'full', 'difference');
  END IF;
END $$;

-- Adicionar coluna na tabela stores
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS redemption_accumulation_type redemption_accumulation_type NOT NULL DEFAULT 'none';

COMMENT ON COLUMN stores.redemption_accumulation_type IS 
'Tipo de acúmulo durante resgate: none (não acumula), full (acumula valor total da venda), difference (acumula diferença entre venda e resgate)';