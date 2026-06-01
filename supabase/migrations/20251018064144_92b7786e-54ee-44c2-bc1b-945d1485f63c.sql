-- Permitir clientes verem a rede à qual eles pertencem
CREATE POLICY "Clients can view own network"
ON public.networks
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role) AND 
  id IN (
    SELECT network_id 
    FROM public.clients 
    WHERE user_id = auth.uid()
  )
);