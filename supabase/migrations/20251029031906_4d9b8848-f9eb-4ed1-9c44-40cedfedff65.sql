-- Criar tabela para templates de mensagens da API
CREATE TABLE public.api_message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_key text NOT NULL UNIQUE,
  message_title text NOT NULL,
  message_template text NOT NULL,
  description text,
  available_tags text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.api_message_templates ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar todos os templates
CREATE POLICY "Admins can manage all message templates"
  ON public.api_message_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Network managers podem visualizar os templates
CREATE POLICY "Network managers can view message templates"
  ON public.api_message_templates
  FOR SELECT
  USING (has_role(auth.uid(), 'network_manager'));

-- Inserir templates padrão
INSERT INTO public.api_message_templates (message_key, message_title, message_template, description, available_tags) VALUES
(
  'client_not_found',
  'Cliente Não Cadastrado',
  'O CPF digitado não consta em nossa base, vamos cadastrar para pontuar essa venda?',
  'Mensagem exibida quando o CPF não é encontrado na base de dados',
  ARRAY['cpf']
),
(
  'client_without_auto_redemption',
  'Cliente Sem Resgate Ativo',
  'Seu saldo é {saldo}. Vamos resgatar? Basta ativar no seu portal cliente o resgate.',
  'Mensagem exibida quando o cliente tem saldo mas não tem resgate automático ativo',
  ARRAY['saldo', 'nome', 'cpf']
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_api_message_templates_updated_at
  BEFORE UPDATE ON public.api_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();