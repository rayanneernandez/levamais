-- Allow store managers to update their own network's loyalty configuration
CREATE POLICY "Store managers can update own network"
ON public.networks
FOR UPDATE
USING (
  id IN (
    SELECT network_id FROM public.store_managers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT network_id FROM public.store_managers WHERE user_id = auth.uid()
  )
);