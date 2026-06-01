-- Adicionar coluna email na tabela profiles para facilitar queries
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Atualizar emails existentes dos usuários auth
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND p.email IS NULL;

-- Criar função para sincronizar email quando usuário é criado/atualizado
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar email no profile
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para sincronizar email
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email();

COMMENT ON COLUMN public.profiles.email IS 'Email do usuário (sincronizado de auth.users)';