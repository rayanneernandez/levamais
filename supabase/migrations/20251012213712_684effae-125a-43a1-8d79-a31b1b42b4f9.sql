-- Criar enum para tipos de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'store_manager', 'client');

-- Criar enum para tipos de programa de fidelidade
CREATE TYPE public.loyalty_type AS ENUM ('points', 'cashback');

-- Criar enum para status
CREATE TYPE public.status AS ENUM ('active', 'inactive', 'suspended');

-- Criar enum para tipo de transação
CREATE TYPE public.transaction_type AS ENUM ('accumulation', 'redemption');

-- ========================================
-- TABELA: profiles (perfis de usuários)
-- ========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ========================================
-- TABELA: user_roles (roles dos usuários)
-- ========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- ========================================
-- FUNÇÃO: Verificar se usuário tem role específica
-- ========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ========================================
-- TABELA: networks (redes de lojas)
-- ========================================
CREATE TABLE public.networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  total_licenses INTEGER NOT NULL DEFAULT 0,
  status status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all networks"
  ON public.networks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create networks"
  ON public.networks FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update networks"
  ON public.networks FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- TABELA: stores (lojas) - SEM políticas que dependem de store_managers
-- ========================================
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  address TEXT,
  loyalty_type loyalty_type NOT NULL DEFAULT 'points',
  points_per_real DECIMAL(10,2) DEFAULT 1.00,
  cashback_percentage DECIMAL(5,2) DEFAULT 5.00,
  points_validity_days INTEGER DEFAULT 365,
  status status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all stores"
  ON public.stores FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view active stores"
  ON public.stores FOR SELECT
  USING (status = 'active' AND public.has_role(auth.uid(), 'client'));

-- ========================================
-- TABELA: store_managers (gerentes de lojas)
-- ========================================
CREATE TABLE public.store_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, network_id)
);

ALTER TABLE public.store_managers ENABLE ROW LEVEL SECURITY;

-- AGORA podemos criar a política que depende de store_managers
CREATE POLICY "Store managers can view own network stores"
  ON public.stores FOR SELECT
  USING (
    public.has_role(auth.uid(), 'store_manager') AND
    network_id IN (
      SELECT network_id FROM public.store_managers WHERE user_id = auth.uid()
    )
  );

-- ========================================
-- TABELA: clients (clientes do programa)
-- ========================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  cpf TEXT NOT NULL UNIQUE,
  favorite_network_id UUID REFERENCES public.networks(id),
  total_points DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own record"
  ON public.clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Clients can update own record"
  ON public.clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all clients"
  ON public.clients FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- TABELA: transactions (transações)
-- ========================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  points DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own transactions"
  ON public.transactions FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Store managers can view store transactions"
  ON public.transactions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'store_manager') AND
    store_id IN (
      SELECT store_id FROM public.store_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- FUNÇÃO: Criar perfil automaticamente
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário')
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- FUNÇÃO: Atualizar updated_at
-- ========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_networks_updated_at
  BEFORE UPDATE ON public.networks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();