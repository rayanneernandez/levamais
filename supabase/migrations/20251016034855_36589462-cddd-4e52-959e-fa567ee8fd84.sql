-- Adicionar política para permitir network managers atualizarem suas lojas
CREATE POLICY "Network managers can update own network stores"
ON public.stores
FOR UPDATE
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
);