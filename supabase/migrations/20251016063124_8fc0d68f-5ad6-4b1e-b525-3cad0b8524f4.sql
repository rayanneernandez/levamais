-- Permitir que network managers vejam profiles de usuários da sua rede
CREATE POLICY "Network managers can view network users profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND id IN (
    SELECT user_id 
    FROM public.store_managers 
    WHERE network_id = get_user_network_id(auth.uid())
  )
);