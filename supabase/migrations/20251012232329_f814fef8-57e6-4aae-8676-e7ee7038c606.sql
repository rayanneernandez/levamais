-- Adicionar campos de contato na tabela stores
ALTER TABLE public.stores 
ADD COLUMN contact_name TEXT,
ADD COLUMN contact_phone TEXT,
ADD COLUMN contact_email TEXT;

-- Comentários
COMMENT ON COLUMN public.stores.contact_name IS 'Nome do contato na loja';
COMMENT ON COLUMN public.stores.contact_phone IS 'Telefone do contato';
COMMENT ON COLUMN public.stores.contact_email IS 'Email do contato';