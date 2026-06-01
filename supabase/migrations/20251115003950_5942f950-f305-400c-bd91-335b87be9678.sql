-- Add store flag and services fields
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS flag TEXT CHECK (flag IN ('ipiranga', 'shell', 'vibra', 'ale', 'branca')),
ADD COLUMN IF NOT EXISTS services TEXT[] DEFAULT '{}';

-- Add comment explaining the services field
COMMENT ON COLUMN stores.services IS 'Available services: conveniencia, totem_eletrico, caixa_24h, troca_oleo, banheiro, chuveiro';
