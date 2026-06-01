-- Criar tabela para configurações de utilização de APIs
CREATE TABLE IF NOT EXISTS api_usage_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type TEXT NOT NULL, -- 'client_sms', 'client_email', 'internal_sms', 'internal_email'
  integration_id UUID REFERENCES api_integrations(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(config_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_api_usage_configs_config_type ON api_usage_configs(config_type);
CREATE INDEX IF NOT EXISTS idx_api_usage_configs_integration_id ON api_usage_configs(integration_id);

-- RLS Policies
ALTER TABLE api_usage_configs ENABLE ROW LEVEL SECURITY;

-- Admin pode ver todas as configurações
CREATE POLICY "Admins can view all usage configs"
  ON api_usage_configs
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admin pode inserir configurações
CREATE POLICY "Admins can insert usage configs"
  ON api_usage_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admin pode atualizar configurações
CREATE POLICY "Admins can update usage configs"
  ON api_usage_configs
  FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Admin pode deletar configurações
CREATE POLICY "Admins can delete usage configs"
  ON api_usage_configs
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_api_usage_configs_updated_at
  BEFORE UPDATE ON api_usage_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir configurações padrão
INSERT INTO api_usage_configs (config_type, integration_id, is_active)
SELECT 
  'internal_sms',
  id,
  true
FROM api_integrations
WHERE provider = 'twilio'
LIMIT 1
ON CONFLICT (config_type) DO NOTHING;

INSERT INTO api_usage_configs (config_type, integration_id, is_active)
SELECT 
  'internal_email',
  id,
  true
FROM api_integrations
WHERE provider = 'resend'
LIMIT 1
ON CONFLICT (config_type) DO NOTHING;

INSERT INTO api_usage_configs (config_type, integration_id, is_active)
SELECT 
  'client_sms',
  NULL,
  false
ON CONFLICT (config_type) DO NOTHING;

INSERT INTO api_usage_configs (config_type, integration_id, is_active)
SELECT 
  'client_email',
  NULL,
  false
ON CONFLICT (config_type) DO NOTHING;