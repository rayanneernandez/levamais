-- Remover políticas problemáticas que causam recursão infinita
DROP POLICY IF EXISTS "Network managers can view network clients" ON public.clients;
DROP POLICY IF EXISTS "Network managers can update network clients" ON public.clients;
DROP POLICY IF EXISTS "Network managers can create clients" ON public.clients;

-- Adicionar coluna network_id na tabela clients para controle de acesso direto
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS network_id uuid REFERENCES public.networks(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_clients_network_id ON public.clients(network_id);

-- Criar políticas RLS simplificadas sem recursão
CREATE POLICY "Network managers can view own network clients" ON public.clients
FOR SELECT USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND
  network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can create clients for own network" ON public.clients
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role) AND
  network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can update own network clients" ON public.clients
FOR UPDATE USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND
  network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can delete own network clients" ON public.clients
FOR DELETE USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND
  network_id = get_user_network_id(auth.uid())
);