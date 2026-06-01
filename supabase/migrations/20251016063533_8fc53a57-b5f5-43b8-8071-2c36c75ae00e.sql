-- Adicionar campos para rastreamento de cadastro via QR Code por atendente
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS registered_by_attendant_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS registered_at_store_id uuid REFERENCES public.stores(id);

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_clients_attendant ON public.clients(registered_by_attendant_id);
CREATE INDEX IF NOT EXISTS idx_clients_store ON public.clients(registered_at_store_id);

COMMENT ON COLUMN public.clients.registered_by_attendant_id IS 'ID do atendente/funcionário que gerou o QR Code usado no cadastro';
COMMENT ON COLUMN public.clients.registered_at_store_id IS 'ID da loja onde o cadastro foi iniciado via QR Code';