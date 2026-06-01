-- Criar tabela de tickets de suporte
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  source text NOT NULL CHECK (source IN ('lojista', 'colaborador', 'cliente')),
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  network_id uuid REFERENCES networks(id),
  created_by_user_id uuid REFERENCES auth.users(id),
  attachments text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_support_tickets_network_id ON support_tickets(network_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON support_tickets(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- Função para gerar número do ticket
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number integer;
  new_ticket_number text;
BEGIN
  -- Buscar o próximo número disponível
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 6) AS INTEGER)), 0) + 1
  INTO next_number
  FROM support_tickets;
  
  -- Gerar número no formato TICK-00001
  new_ticket_number := 'TICK-' || LPAD(next_number::text, 5, '0');
  
  NEW.ticket_number := new_ticket_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar número do ticket automaticamente
CREATE TRIGGER generate_ticket_number_trigger
BEFORE INSERT ON support_tickets
FOR EACH ROW
WHEN (NEW.ticket_number IS NULL)
EXECUTE FUNCTION generate_ticket_number();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Admins podem ver todos os tickets
CREATE POLICY "Admins can view all tickets"
ON support_tickets
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins podem criar tickets
CREATE POLICY "Admins can create tickets"
ON support_tickets
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins podem atualizar tickets
CREATE POLICY "Admins can update tickets"
ON support_tickets
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários autenticados podem criar tickets
CREATE POLICY "Authenticated users can create tickets"
ON support_tickets
FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

-- Usuários podem ver seus próprios tickets
CREATE POLICY "Users can view their own tickets"
ON support_tickets
FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

-- Network managers podem ver tickets de suas redes
CREATE POLICY "Network managers can view network tickets"
ON support_tickets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND
  network_id = get_user_network_id(auth.uid())
);

-- Criar bucket para arquivos de suporte
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para o bucket de support-attachments
-- Usuários autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload support files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'support-attachments');

-- Usuários podem visualizar seus próprios arquivos
CREATE POLICY "Users can view their own support files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins podem visualizar todos os arquivos de suporte
CREATE POLICY "Admins can view all support files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Usuários podem deletar seus próprios arquivos
CREATE POLICY "Users can delete their own support files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'support-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins podem deletar qualquer arquivo de suporte
CREATE POLICY "Admins can delete support files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'support-attachments' AND
  has_role(auth.uid(), 'admin'::app_role)
);