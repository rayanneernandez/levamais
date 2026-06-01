-- Adicionar campos para controle de janela 24h e mensagens aguardando resposta
ALTER TABLE public.whatsapp_message_queue
ADD COLUMN IF NOT EXISTS waiting_for_template_reply boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS template_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS original_message_text text,
ADD COLUMN IF NOT EXISTS conversation_window_checked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_active_window boolean;

-- Criar tabela para armazenar configuração de template padrão por rede
CREATE TABLE IF NOT EXISTS public.whatsapp_network_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id uuid NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  default_template_name text,
  default_template_language text DEFAULT 'pt_BR',
  department_id text DEFAULT 'a9355171-0c38-40e3-9f22-4ed123ddaf69',
  auto_send_template boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(network_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_network_settings ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_network_settings
CREATE POLICY "Admins can manage all whatsapp settings"
ON public.whatsapp_network_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can manage own settings"
ON public.whatsapp_network_settings FOR ALL
USING (network_id = get_user_network_id(auth.uid()));

-- Função para verificar se há janela de 24h ativa
CREATE OR REPLACE FUNCTION public.has_active_conversation_window(p_phone text, p_network_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  last_inbound timestamp with time zone;
BEGIN
  -- Buscar última mensagem RECEBIDA do cliente (direction = 'in')
  SELECT timestamp INTO last_inbound
  FROM whatsapp_conversation_history
  WHERE phone = p_phone
    AND network_id = p_network_id
    AND direction = 'in'
  ORDER BY timestamp DESC
  LIMIT 1;
  
  -- Se não há mensagem recebida ou tem mais de 24h, não há janela
  IF last_inbound IS NULL OR last_inbound < (now() - interval '24 hours') THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION public.has_active_conversation_window IS 'Verifica se existe uma janela de conversa de 24h ativa para enviar mensagens livres';