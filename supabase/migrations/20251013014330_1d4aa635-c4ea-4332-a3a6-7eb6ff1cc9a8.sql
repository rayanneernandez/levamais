-- Adicionar policy para permitir que usuários atualizem seu próprio campo must_change_password
CREATE POLICY "Users can update own must_change_password flag"
ON public.store_managers
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);