-- Função para criar usuário da empresa ao cadastrar
CREATE OR REPLACE FUNCTION public.create_network_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    crypt(temp_password, gen_salt('bf')),
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

-- Trigger para criar usuário ao cadastrar empresa
DROP TRIGGER IF EXISTS on_network_created ON public.networks;
CREATE TRIGGER on_network_created
  AFTER INSERT ON public.networks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_network_user();

-- RLS policy para network_manager ver apenas sua rede
CREATE POLICY "Network managers can view own network"
ON public.networks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND id IN (
    SELECT network_id 
    FROM store_managers 
    WHERE user_id = auth.uid()
  )
);

-- RLS policy para network_manager ver lojas da sua rede
CREATE POLICY "Network managers can view own network stores"
ON public.stores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id IN (
    SELECT network_id 
    FROM store_managers 
    WHERE user_id = auth.uid() AND store_id IS NULL
  )
);