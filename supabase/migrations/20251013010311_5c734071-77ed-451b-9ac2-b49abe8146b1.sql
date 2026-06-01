-- Recriar função com referência correta ao schema das extensões
CREATE OR REPLACE FUNCTION public.create_network_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  new_user_id uuid;
  temp_password text := 'Global@2025';
BEGIN
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

  -- Criar perfil
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (new_user_id, NEW.name, NEW.email, NEW.phone);

  -- Adicionar role de network_manager
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'network_manager');

  -- Associar usuário à rede
  INSERT INTO public.store_managers (user_id, network_id, store_id)
  VALUES (new_user_id, NEW.id, null);

  RETURN NEW;
END;
$$;