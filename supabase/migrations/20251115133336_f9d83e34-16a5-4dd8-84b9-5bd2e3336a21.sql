-- Permitir que network managers possam atualizar (responder) avaliações da sua rede
CREATE POLICY "Network managers can reply to network ratings"
ON public.transaction_ratings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND 
  network_id = get_user_network_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role) AND 
  network_id = get_user_network_id(auth.uid())
);