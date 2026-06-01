-- Criar função para criar usuário da revenda automaticamente
CREATE OR REPLACE FUNCTION public.create_reseller_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  new_user_id uuid;
  temp_password text := 'Global@2025';
  email_exists boolean;
BEGIN
  -- Só criar usuário se a revenda estiver ativa
  IF NEW.is_active != true THEN
    RETURN NEW;
  END IF;

  -- Verificar se já existe usuário com esse email
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE email = NEW.email
  ) INTO email_exists;

  -- Se o email já existe, não criar novamente
  IF email_exists THEN
    RETURN NEW;
  END IF;

  -- Criar usuário no auth.users
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
    jsonb_build_object('full_name', NEW.owner_name, 'company_name', NEW.company_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Criar perfil com force_password_change = true
  INSERT INTO public.profiles (id, full_name, email, phone, force_password_change)
  VALUES (
    new_user_id,
    NEW.owner_name,
    NEW.email,
    NEW.phone,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = NEW.email,
    phone = NEW.phone,
    full_name = NEW.owner_name,
    force_password_change = true;

  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função após inserir uma revenda
CREATE TRIGGER create_reseller_user_trigger
  AFTER INSERT ON public.resellers
  FOR EACH ROW
  EXECUTE FUNCTION public.create_reseller_user();

-- Criar trigger para quando reativar uma revenda (se não tiver usuário ainda)
CREATE TRIGGER reactivate_reseller_user_trigger
  AFTER UPDATE ON public.resellers
  FOR EACH ROW
  WHEN (OLD.is_active = false AND NEW.is_active = true)
  EXECUTE FUNCTION public.create_reseller_user();