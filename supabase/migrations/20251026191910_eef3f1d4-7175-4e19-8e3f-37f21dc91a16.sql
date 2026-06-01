-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Resellers can view own record" ON public.resellers;
DROP POLICY IF EXISTS "Resellers can update own record" ON public.resellers;
DROP POLICY IF EXISTS "Public can verify reseller email" ON public.resellers;

-- Criar função security definer para verificar se email do usuário bate com email de revendedor
CREATE OR REPLACE FUNCTION public.is_reseller_for_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resellers
    WHERE email = _email
  )
$$;

-- Política para revendedores verem seu próprio registro
CREATE POLICY "Resellers can view own record"
ON public.resellers
FOR SELECT
TO authenticated
USING (
  email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

-- Política para revendedores atualizarem seu próprio registro
CREATE POLICY "Resellers can update own record"
ON public.resellers
FOR UPDATE
TO authenticated
USING (
  email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
)
WITH CHECK (
  email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

-- Política para verificação pública de email (necessária para login)
CREATE POLICY "Anyone can check if reseller exists"
ON public.resellers
FOR SELECT
TO anon, authenticated
USING (true);