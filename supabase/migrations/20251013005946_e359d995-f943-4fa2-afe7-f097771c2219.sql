-- Adicionar flag para forçar troca de senha no primeiro login
ALTER TABLE public.store_managers
ADD COLUMN must_change_password boolean DEFAULT true;

-- Criar tabela de perfis de acesso para funcionários da rede
CREATE TABLE public.store_access_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  permissions jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(network_id, name)
);

-- Enable RLS
ALTER TABLE public.store_access_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies para perfis de acesso
CREATE POLICY "Network managers can view own network profiles"
ON public.store_access_profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id IN (
    SELECT network_id 
    FROM store_managers 
    WHERE user_id = auth.uid() AND store_id IS NULL
  )
);

CREATE POLICY "Network managers can create profiles"
ON public.store_access_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id IN (
    SELECT network_id 
    FROM store_managers 
    WHERE user_id = auth.uid() AND store_id IS NULL
  )
);

CREATE POLICY "Network managers can update own network profiles"
ON public.store_access_profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id IN (
    SELECT network_id 
    FROM store_managers 
    WHERE user_id = auth.uid() AND store_id IS NULL
  )
);

CREATE POLICY "Network managers can delete own network profiles"
ON public.store_access_profiles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id IN (
    SELECT network_id 
    FROM store_managers 
    WHERE user_id = auth.uid() AND store_id IS NULL
  )
);

-- Adicionar campo de perfil de acesso em store_managers
ALTER TABLE public.store_managers
ADD COLUMN access_profile_id uuid REFERENCES public.store_access_profiles(id);

-- Atualizar RLS para permitir network managers verem seus gerentes
CREATE POLICY "Network managers can view own network managers"
ON public.store_managers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role)
  AND network_id IN (
    SELECT network_id 
    FROM store_managers 
    WHERE user_id = auth.uid() AND store_id IS NULL
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_store_access_profiles_updated_at
BEFORE UPDATE ON public.store_access_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();