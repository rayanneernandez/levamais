-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS create_network_user_trigger ON public.networks;

-- Atualizar função para só criar usuário quando status for 'active'
CREATE OR REPLACE FUNCTION public.create_network_user()
RETURNS TRIGGER AS $$
DECLARE
  new_user_id uuid;
  temp_password text := 'Global@2025';
BEGIN
  -- Só criar usuário se status for 'active'
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Verificar se já existe usuário para essa rede
  IF EXISTS (
    SELECT 1 FROM public.store_managers 
    WHERE network_id = NEW.id AND store_id IS NULL
  ) THEN
    -- Já existe gestor, não criar novamente
    RETURN NEW;
  END IF;

  -- Criar usuário com email da empresa e senha padrão
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    NEW.email,
    extensions.crypt(temp_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', NEW.name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Atualizar perfil criado pelo trigger com dados adicionais
  UPDATE public.profiles
  SET email = NEW.email,
      phone = NEW.phone,
      full_name = NEW.name
  WHERE id = new_user_id;

  -- Adicionar role de network_manager
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'network_manager');

  -- Associar usuário à rede
  INSERT INTO public.store_managers (user_id, network_id, store_id)
  VALUES (new_user_id, NEW.id, null);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Criar trigger para INSERT e UPDATE
CREATE TRIGGER create_network_user_trigger
  AFTER INSERT OR UPDATE OF status ON public.networks
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.create_network_user();