-- Modificar trigger para adicionar role de admin automaticamente para o email especificado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário')
  );
  
  -- Adicionar role de admin se for o email do criador
  IF new.email = 'bruno.lyra@levemaisfidelidade.com.br' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
  END IF;
  
  RETURN new;
END;
$function$;