-- =====================================================
-- INTEGRAÇÃO ASAAS - ESTRUTURA DO BANCO DE DADOS
-- =====================================================

-- Tabela de configuração do Asaas
CREATE TABLE IF NOT EXISTS public.asaas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_production text,
  api_key_sandbox text,
  is_sandbox boolean DEFAULT true,
  webhook_url text,
  webhook_token text DEFAULT gen_random_uuid()::text,
  is_active boolean DEFAULT false,
  last_test_at timestamp with time zone,
  last_test_status text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de planos de upgrade (SMS, Email, WhatsApp, +Coins, Combustível)
CREATE TABLE IF NOT EXISTS public.upgrade_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  plan_type text NOT NULL CHECK (plan_type IN ('sms', 'email', 'whatsapp', 'coins', 'fuel_analysis')),
  quantity integer NOT NULL DEFAULT 0, -- quantidade de créditos/licenças
  monthly_value numeric(10,2) NOT NULL,
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  is_active boolean DEFAULT true,
  benefits jsonb, -- JSON com lista de benefícios
  highlight_badge text, -- "Mais Vendido", "Melhor Custo-Benefício"
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de assinaturas ativas das redes
CREATE TABLE IF NOT EXISTS public.network_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.upgrade_plans(id) ON DELETE RESTRICT,
  asaas_subscription_id text, -- ID da assinatura no Asaas
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
  start_date timestamp with time zone,
  next_billing_date timestamp with time zone,
  cancellation_date timestamp with time zone,
  cancellation_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(network_id, plan_id, status) -- Previne duplicação de plano ativo
);

-- Tabela de produtos físicos (marketplace)
CREATE TABLE IF NOT EXISTS public.marketplace_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text, -- "Media Kit", "Adesivos", "Materiais"
  price numeric(10,2) NOT NULL,
  stock_quantity integer DEFAULT 0,
  image_url text,
  is_active boolean DEFAULT true,
  specifications jsonb, -- JSON com especificações técnicas
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de pedidos de produtos
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  total_amount numeric(10,2) NOT NULL,
  shipping_fee numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
  asaas_charge_id text,
  payment_method text, -- "boleto", "pix", "credit_card"
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'failed', 'refunded')),
  
  -- Endereço de entrega
  shipping_address jsonb NOT NULL, -- { street, number, complement, neighborhood, city, state, zipcode }
  
  -- Itens do pedido
  items jsonb NOT NULL, -- [{ product_id, name, quantity, unit_price }]
  
  tracking_code text,
  notes text,
  
  paid_at timestamp with time zone,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Sequência para order_number
CREATE SEQUENCE IF NOT EXISTS marketplace_order_number_seq START 1;

-- Tabela de cobranças do Asaas (unificada para planos e produtos)
CREATE TABLE IF NOT EXISTS public.asaas_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_charge_id text UNIQUE NOT NULL,
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  
  -- Referência ao que está sendo cobrado
  subscription_id uuid REFERENCES public.network_subscriptions(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  
  charge_type text NOT NULL CHECK (charge_type IN ('subscription', 'product', 'one_time')),
  
  amount numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'overdue', 'failed', 'refunded')),
  
  payment_method text, -- "boleto", "pix", "credit_card"
  billing_type text, -- "BOLETO", "CREDIT_CARD", "PIX"
  
  -- Links de pagamento
  bank_slip_url text,
  invoice_url text,
  pix_qrcode text,
  
  confirmed_at timestamp with time zone,
  payment_date date,
  
  description text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de log de webhooks do Asaas
CREATE TABLE IF NOT EXISTS public.asaas_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  asaas_charge_id text,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_network_subscriptions_network ON public.network_subscriptions(network_id);
CREATE INDEX IF NOT EXISTS idx_network_subscriptions_status ON public.network_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_network ON public.marketplace_orders(network_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON public.marketplace_orders(status);
CREATE INDEX IF NOT EXISTS idx_asaas_charges_network ON public.asaas_charges(network_id);
CREATE INDEX IF NOT EXISTS idx_asaas_charges_status ON public.asaas_charges(status);
CREATE INDEX IF NOT EXISTS idx_asaas_webhooks_processed ON public.asaas_webhooks(processed);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_asaas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_asaas_config_updated_at
  BEFORE UPDATE ON public.asaas_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_asaas_updated_at();

CREATE TRIGGER update_upgrade_plans_updated_at
  BEFORE UPDATE ON public.upgrade_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_asaas_updated_at();

CREATE TRIGGER update_network_subscriptions_updated_at
  BEFORE UPDATE ON public.network_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_asaas_updated_at();

CREATE TRIGGER update_marketplace_products_updated_at
  BEFORE UPDATE ON public.marketplace_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_asaas_updated_at();

CREATE TRIGGER update_marketplace_orders_updated_at
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_asaas_updated_at();

CREATE TRIGGER update_asaas_charges_updated_at
  BEFORE UPDATE ON public.asaas_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_asaas_updated_at();

-- Trigger para gerar order_number automaticamente
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || LPAD(nextval('marketplace_order_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.asaas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upgrade_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_webhooks ENABLE ROW LEVEL SECURITY;

-- Policies para asaas_config (apenas admin)
CREATE POLICY "Admin pode ver config Asaas"
  ON public.asaas_config FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin pode atualizar config Asaas"
  ON public.asaas_config FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin pode inserir config Asaas"
  ON public.asaas_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policies para upgrade_plans
CREATE POLICY "Admin pode gerenciar planos"
  ON public.upgrade_plans FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Network managers podem ver planos ativos"
  ON public.upgrade_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies para network_subscriptions
CREATE POLICY "Admin pode ver todas assinaturas"
  ON public.network_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Network manager pode ver suas assinaturas"
  ON public.network_subscriptions FOR SELECT
  TO authenticated
  USING (network_id = public.get_user_network_id(auth.uid()));

CREATE POLICY "Network manager pode criar assinatura"
  ON public.network_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (network_id = public.get_user_network_id(auth.uid()));

CREATE POLICY "Network manager pode cancelar sua assinatura"
  ON public.network_subscriptions FOR UPDATE
  TO authenticated
  USING (network_id = public.get_user_network_id(auth.uid()));

-- Policies para marketplace_products
CREATE POLICY "Admin pode gerenciar produtos"
  ON public.marketplace_products FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Network managers podem ver produtos ativos"
  ON public.marketplace_products FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies para marketplace_orders
CREATE POLICY "Admin pode ver todos pedidos"
  ON public.marketplace_orders FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Network manager pode ver seus pedidos"
  ON public.marketplace_orders FOR SELECT
  TO authenticated
  USING (network_id = public.get_user_network_id(auth.uid()));

CREATE POLICY "Network manager pode criar pedido"
  ON public.marketplace_orders FOR INSERT
  TO authenticated
  WITH CHECK (network_id = public.get_user_network_id(auth.uid()));

-- Policies para asaas_charges
CREATE POLICY "Admin pode ver todas cobranças"
  ON public.asaas_charges FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Network manager pode ver suas cobranças"
  ON public.asaas_charges FOR SELECT
  TO authenticated
  USING (network_id = public.get_user_network_id(auth.uid()));

-- Policies para asaas_webhooks (apenas admin e service_role)
CREATE POLICY "Admin pode ver webhooks"
  ON public.asaas_webhooks FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Inserir configuração inicial do Asaas
INSERT INTO public.asaas_config (id, is_sandbox, is_active)
VALUES (gen_random_uuid(), true, false)
ON CONFLICT DO NOTHING;