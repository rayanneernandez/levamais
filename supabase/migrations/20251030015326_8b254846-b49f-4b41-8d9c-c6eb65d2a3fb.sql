-- Adicionar coluna para armazenar credenciais das integrações
ALTER TABLE api_integrations
ADD COLUMN IF NOT EXISTS credentials JSONB;

-- Comentário explicativo
COMMENT ON COLUMN api_integrations.credentials IS 'Armazena credenciais sensíveis da API (tokens, chaves, etc.) em formato JSON criptografado';

-- Atualizar integrações existentes com estrutura de credenciais vazia
UPDATE api_integrations
SET credentials = '{}'::jsonb
WHERE credentials IS NULL;