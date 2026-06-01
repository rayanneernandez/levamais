-- Adicionar flag de atendente/frentista e campo de referral
ALTER TABLE public.store_managers
ADD COLUMN IF NOT EXISTS is_attendant boolean DEFAULT false;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS referred_by_user_id uuid REFERENCES auth.users(id);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.store_managers.is_attendant IS 'Identifica se o usuário é atendente/frentista que pode gerar cadastros via QRCode';
COMMENT ON COLUMN public.clients.referred_by_user_id IS 'ID do atendente que realizou o cadastro via QRCode';