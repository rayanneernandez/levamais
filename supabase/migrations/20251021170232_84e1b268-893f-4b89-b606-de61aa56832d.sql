-- Adicionar campo para forçar troca de senha no primeiro acesso
ALTER TABLE public.profiles
ADD COLUMN force_password_change boolean NOT NULL DEFAULT false;

-- Atualizar função handle_new_user para marcar que precisa trocar senha
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (id, full_name, force_password_change)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'),
    true  -- Sempre forçar troca de senha no primeiro acesso
  );
  
  -- Adicionar role de admin se for o email do criador
  IF new.email = 'bruno.lyra@levamaisfidelidade.com.br' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
  END IF;
  
  RETURN new;
END;
$$;