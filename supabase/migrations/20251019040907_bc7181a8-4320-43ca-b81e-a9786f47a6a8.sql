-- Permitir que admins atualizem clientes
CREATE POLICY "Admins can update all clients"
ON public.clients
FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));