-- Permitir que todos os usuários autenticados vejam informações básicas das redes
-- Isso é necessário para joins em queries de clientes e promoções
CREATE POLICY "Authenticated users can view basic network info"
ON public.networks
FOR SELECT
TO authenticated
USING (true);