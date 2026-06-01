-- Restringir acesso à tabela system_menus apenas para usuários autenticados
DROP POLICY IF EXISTS "Everyone can view system menus" ON public.system_menus;

CREATE POLICY "Authenticated users can view system menus"
ON public.system_menus
FOR SELECT
USING (auth.uid() IS NOT NULL);