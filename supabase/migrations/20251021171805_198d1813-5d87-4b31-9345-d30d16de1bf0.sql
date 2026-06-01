-- Permitir que atendentes vejam seus próprios dados
CREATE POLICY "Attendants can view own data"
ON public.store_managers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND is_attendant = true);