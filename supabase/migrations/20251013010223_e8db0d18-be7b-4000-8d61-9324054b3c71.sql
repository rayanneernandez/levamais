-- Criar função para buscar network_id do usuário sem recursão
CREATE OR REPLACE FUNCTION public.get_user_network_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT network_id
  FROM public.store_managers
  WHERE user_id = _user_id AND store_id IS NULL
  LIMIT 1
$$;

-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Network managers can view own network" ON public.networks;
DROP POLICY IF EXISTS "Network managers can view own network stores" ON public.stores;
DROP POLICY IF EXISTS "Network managers can view own network managers" ON public.store_managers;
DROP POLICY IF EXISTS "Network managers can view own network profiles" ON public.store_access_profiles;
DROP POLICY IF EXISTS "Network managers can create profiles" ON public.store_access_profiles;
DROP POLICY IF EXISTS "Network managers can update own network profiles" ON public.store_access_profiles;
DROP POLICY IF EXISTS "Network managers can delete own network profiles" ON public.store_access_profiles;

-- Recriar políticas usando a função security definer
CREATE POLICY "Network managers can view own network"
ON public.networks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can view own network stores"
ON public.stores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can view own network managers"
ON public.store_managers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can view own network profiles"
ON public.store_access_profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can create profiles"
ON public.store_access_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can update own network profiles"
ON public.store_access_profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can delete own network profiles"
ON public.store_access_profiles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id = get_user_network_id(auth.uid())
);