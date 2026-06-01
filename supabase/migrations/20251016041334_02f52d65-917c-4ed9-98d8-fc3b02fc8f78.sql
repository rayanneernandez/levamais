-- Adicionar campos necessários na tabela clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS address_street text,
ADD COLUMN IF NOT EXISTS address_number text,
ADD COLUMN IF NOT EXISTS address_complement text,
ADD COLUMN IF NOT EXISTS address_neighborhood text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text,
ADD COLUMN IF NOT EXISTS address_zip text,
ADD COLUMN IF NOT EXISTS address_country text NOT NULL DEFAULT 'Brasil',
ADD COLUMN IF NOT EXISTS is_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_validated boolean DEFAULT false;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);

-- Atualizar políticas RLS para network managers verem clientes da rede
CREATE POLICY "Network managers can view network clients" ON public.clients
FOR SELECT USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.transactions t
    JOIN public.stores s ON s.id = t.store_id
    WHERE t.client_id = clients.id
    AND s.network_id = get_user_network_id(auth.uid())
  )
);

-- Network managers podem atualizar dados dos clientes da rede
CREATE POLICY "Network managers can update network clients" ON public.clients
FOR UPDATE USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.transactions t
    JOIN public.stores s ON s.id = t.store_id
    WHERE t.client_id = clients.id
    AND s.network_id = get_user_network_id(auth.uid())
  )
);

-- Network managers podem criar clientes
CREATE POLICY "Network managers can create clients" ON public.clients
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role)
);