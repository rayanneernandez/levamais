-- Criar tabela para armazenar integrações de API
CREATE TABLE IF NOT EXISTS api_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'twilio', 'resend', 'brasil_api_cnpj', 'brasil_api_cep', etc
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'error'
  config JSONB, -- Configurações específicas (não sensíveis)
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_api_integrations_provider ON api_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_api_integrations_status ON api_integrations(status);

-- RLS Policies
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;

-- Admin pode ver todas as integrações
CREATE POLICY "Admins can view all integrations"
  ON api_integrations
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admin pode inserir integrações
CREATE POLICY "Admins can insert integrations"
  ON api_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admin pode atualizar integrações
CREATE POLICY "Admins can update integrations"
  ON api_integrations
  FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Admin pode deletar integrações
CREATE POLICY "Admins can delete integrations"
  ON api_integrations
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_api_integrations_updated_at
  BEFORE UPDATE ON api_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir integrações existentes
INSERT INTO api_integrations (name, provider, description, status, config) VALUES
  ('Twilio SMS', 'twilio', 'Serviço de envio de SMS e verificação', 'active', '{"features": ["SMS", "Verificação"]}'),
  ('Resend Email', 'resend', 'Serviço de envio de emails transacionais', 'active', '{"features": ["Email Transacional", "Templates"]}'),
  ('BrasilAPI CNPJ', 'brasil_api_cnpj', 'Consulta de dados de empresas por CNPJ', 'active', '{"endpoint": "https://brasilapi.com.br/api/cnpj/v1"}'),
  ('BrasilAPI CEP', 'brasil_api_cep', 'Consulta de endereços por CEP', 'active', '{"endpoint": "https://brasilapi.com.br/api/cep/v2"}');