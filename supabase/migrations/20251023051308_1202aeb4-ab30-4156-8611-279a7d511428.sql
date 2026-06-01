-- Criar tabela para templates de mensagens de marketing
CREATE TABLE IF NOT EXISTS marketing_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  template_type TEXT NOT NULL CHECK (template_type IN ('resgate', 'acumulo', 'aniversario', 'promocao')),
  
  -- Campos para Email
  subject TEXT,
  
  -- Conteúdo da mensagem
  message_content TEXT NOT NULL,
  
  -- Configurações de envio automático
  auto_send_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Garantir único template por tipo/canal/rede
  UNIQUE(network_id, channel, template_type)
);

-- Habilitar RLS
ALTER TABLE marketing_message_templates ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Network managers can view own templates"
  ON marketing_message_templates
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can insert own templates"
  ON marketing_message_templates
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can update own templates"
  ON marketing_message_templates
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can delete own templates"
  ON marketing_message_templates
  FOR DELETE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

-- Trigger para updated_at
CREATE TRIGGER update_marketing_message_templates_updated_at
  BEFORE UPDATE ON marketing_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir templates padrão para cada tipo
-- Nota: Estes serão criados quando o network manager acessar pela primeira vez