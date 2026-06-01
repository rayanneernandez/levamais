-- Corrigir avisos de segurança

-- Adicionar RLS policies para store_managers
CREATE POLICY "Admins can view all store managers"
ON public.store_managers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert store managers"
ON public.store_managers
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update store managers"
ON public.store_managers
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete store managers"
ON public.store_managers
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Corrigir search_path das funções existentes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário')
  );
  RETURN new;
END;
$function$;