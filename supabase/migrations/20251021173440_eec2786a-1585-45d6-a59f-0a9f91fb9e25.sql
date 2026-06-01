-- Permitir que network managers vejam os menus do portal lojista
CREATE POLICY "Network managers can view store menus"
ON public.system_menus
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND route LIKE '/levaloja%'
);