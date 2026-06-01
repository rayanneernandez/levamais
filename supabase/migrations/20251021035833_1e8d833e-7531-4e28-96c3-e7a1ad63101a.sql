-- Remover a policy anterior não permissiva
DROP POLICY IF EXISTS "Public can create leads via website" ON public.leads;

-- Recriar como permissiva para permitir inserção pública OU comercial
CREATE POLICY "Public can create leads via website"
ON public.leads
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (
  source IN ('whatsapp_button', 'website') 
  AND status = 'new'
);

-- Tornar a policy de usuários comerciais também permissiva
DROP POLICY IF EXISTS "Commercial users can create leads" ON public.leads;

CREATE POLICY "Commercial users can create leads"
ON public.leads
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  ((SELECT is_commercial FROM profiles WHERE id = auth.uid()) = true) 
  OR has_role(auth.uid(), 'admin'::app_role)
);