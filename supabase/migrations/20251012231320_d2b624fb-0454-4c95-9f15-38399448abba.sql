-- Adicionar política de DELETE para admins na tabela networks
CREATE POLICY "Admins can delete networks"
ON public.networks
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));