-- Corrigir política de visualização de comissões de revendedores
DROP POLICY IF EXISTS "Resellers can view own commissions" ON public.reseller_commissions;

-- Criar política simplificada
CREATE POLICY "Resellers can view own commissions"
ON public.reseller_commissions
FOR SELECT
TO authenticated
USING (
  reseller_id IN (
    SELECT id
    FROM public.resellers
    WHERE email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
);