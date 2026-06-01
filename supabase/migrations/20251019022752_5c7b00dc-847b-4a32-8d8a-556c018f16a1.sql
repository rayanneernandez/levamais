-- Adicionar política RLS para network managers visualizarem transações das suas lojas
CREATE POLICY "Network managers can view own network transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND store_id IN (
    SELECT s.id 
    FROM stores s 
    WHERE s.network_id = get_user_network_id(auth.uid())
  )
);