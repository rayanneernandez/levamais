-- Permitir que network managers deletem ajustes da própria rede
CREATE POLICY "Network managers can delete own network adjustments"
ON public.balance_adjustments
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
);