-- Adicionar políticas de INSERT e UPDATE para admins na tabela stores
CREATE POLICY "Admins can create stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update stores"
ON public.stores
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete stores"
ON public.stores
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));