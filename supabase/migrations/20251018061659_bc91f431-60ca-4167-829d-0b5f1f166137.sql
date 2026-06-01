-- Add INSERT policy for network managers to insert transactions
CREATE POLICY "Network managers can insert transactions for their stores"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND store_id IN (
    SELECT stores.id 
    FROM stores
    WHERE stores.network_id = get_user_network_id(auth.uid())
  )
);