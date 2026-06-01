-- Permitir busca de atendente por código antes do login (apenas user_id)
CREATE POLICY "Anyone can search attendant by code for login"
ON public.store_managers
FOR SELECT
TO public
USING (is_attendant = true);