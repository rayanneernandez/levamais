-- Modificar a função de criação de usuário revendedor
-- Agora não cria mais com senha temporária, apenas cria o registro
-- O email de boas-vindas enviará link de reset de senha

DROP FUNCTION IF EXISTS public.create_reseller_user() CASCADE;

CREATE OR REPLACE FUNCTION public.create_reseller_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  new_user_id uuid;
  email_exists boolean;
BEGIN
  -- Só processar se a revenda estiver ativa
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

  -- Criar usuário no auth.users SEM SENHA (será definida via link de reset)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
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
    now(), -- Email já confirmado
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

  -- Criar perfil SEM forçar troca de senha (senha será criada via link)
  INSERT INTO public.profiles (id, full_name, email, phone, force_password_change)
  VALUES (
    new_user_id,
    NEW.owner_name,
    NEW.email,
    NEW.phone,
    false  -- Não forçar troca pois usuário vai criar senha via link
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = NEW.email,
    phone = NEW.phone,
    full_name = NEW.owner_name,
    force_password_change = false;

  RETURN NEW;
END;
$$;