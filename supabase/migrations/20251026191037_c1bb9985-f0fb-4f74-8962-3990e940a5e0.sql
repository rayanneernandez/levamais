-- Permitir que usuários autenticados vejam seu próprio registro de revendedor
CREATE POLICY "Resellers can view own record"
ON public.resellers
FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Permitir que usuários autenticados atualizem seu próprio registro
CREATE POLICY "Resellers can update own record"
ON public.resellers
FOR UPDATE
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Permitir verificação de email antes do login (sem autenticação)
CREATE POLICY "Public can verify reseller email"
ON public.resellers
FOR SELECT
TO anon
USING (true);