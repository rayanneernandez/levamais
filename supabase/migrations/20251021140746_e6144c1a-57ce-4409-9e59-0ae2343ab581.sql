-- Permitir que usuários não autenticados vejam lojas ativas
-- Isso é necessário para a página de login mostrar as lojas parceiras
CREATE POLICY "Public can view active stores"
ON public.stores
FOR SELECT
TO public
USING (status = 'active'::status);