-- Permitir que atendentes vejam a rede à qual pertencem
CREATE POLICY "Attendants can view own network"
ON public.networks
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT network_id 
    FROM store_managers 
    WHERE user_id = auth.uid() AND is_attendant = true
  )
);

-- Permitir que atendentes vejam sua loja (se houver)
CREATE POLICY "Attendants can view own store"
ON public.stores
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT store_id 
    FROM store_managers 
    WHERE user_id = auth.uid() AND is_attendant = true AND store_id IS NOT NULL
  )
);