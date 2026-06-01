-- LEVA+ ONE - ETAPA 1: FUNDAÇÃO DO BANCO DE DADOS

-- 1.1 Criar Tabelas Principais

-- Tabela de assinaturas Leva+ One
CREATE TABLE IF NOT EXISTS public.client_subscriptions_one (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  network_id uuid REFERENCES public.networks(id) ON DELETE CASCADE,
  asaas_subscription_id text UNIQUE,
  asaas_customer_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
  start_date timestamptz,
  cancelled_at timestamptz,
  monthly_value numeric(10,2) DEFAULT 9.90,
  minimum_period_months integer DEFAULT 3,
  can_cancel boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de promoções ONE
CREATE TABLE IF NOT EXISTS public.one_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid REFERENCES public.networks(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  promotion_type text NOT NULL CHECK (promotion_type IN ('buy_x_get_y', 'percentage_discount', 'combo', 'fixed_discount')),
  rules jsonb NOT NULL,
  max_redemptions integer,
  current_redemptions integer DEFAULT 0,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de produtos das promoções
CREATE TABLE IF NOT EXISTS public.one_promotion_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES public.one_promotions(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  product_name text,
  quantity_required integer DEFAULT 1,
  is_reward boolean DEFAULT false,
  discount_percentage numeric(5,2),
  discount_value numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- Tabela de lojas participantes
CREATE TABLE IF NOT EXISTS public.one_promotion_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES public.one_promotions(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, store_id)
);

-- Tabela de resgates
CREATE TABLE IF NOT EXISTS public.one_promotion_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES public.one_promotions(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  benefit_value numeric(10,2),
  metadata jsonb,
  redeemed_at timestamptz DEFAULT now()
);

-- Tabela de configuração de comissão
CREATE TABLE IF NOT EXISTS public.network_one_commission_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid UNIQUE REFERENCES public.networks(id) ON DELETE CASCADE,
  commission_type text DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value numeric(10,2) NOT NULL,
  payment_day_offset integer DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.2 Adicionar Campos em Tabelas Existentes

-- Marcar clientes como membros ONE
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS is_one_member boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS one_member_since timestamptz;

-- Marcar transações relacionadas a promoções ONE
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_one_promotion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS one_promotion_id uuid REFERENCES public.one_promotions(id);

-- 1.3 Índices e Performance

CREATE INDEX IF NOT EXISTS idx_client_subs_one_client ON public.client_subscriptions_one(client_id);
CREATE INDEX IF NOT EXISTS idx_client_subs_one_network ON public.client_subscriptions_one(network_id);
CREATE INDEX IF NOT EXISTS idx_client_subs_one_status ON public.client_subscriptions_one(status);
CREATE INDEX IF NOT EXISTS idx_one_promos_network ON public.one_promotions(network_id);
CREATE INDEX IF NOT EXISTS idx_one_promos_active ON public.one_promotions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_one_promos_dates ON public.one_promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_clients_one_member ON public.clients(is_one_member) WHERE is_one_member = true;
CREATE INDEX IF NOT EXISTS idx_one_redemptions_promotion ON public.one_promotion_redemptions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_one_redemptions_client ON public.one_promotion_redemptions(client_id);

-- 1.4 RLS Policies

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.client_subscriptions_one ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_promotion_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_one_commission_config ENABLE ROW LEVEL SECURITY;

-- Policies para client_subscriptions_one
CREATE POLICY "Admins manage all ONE subscriptions" ON public.client_subscriptions_one FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients view own ONE subscription" ON public.client_subscriptions_one FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Store managers view network ONE subscriptions" ON public.client_subscriptions_one FOR SELECT
  USING (network_id = public.get_user_network_id(auth.uid()));

-- Policies para one_promotions
CREATE POLICY "Admins manage all ONE promotions" ON public.one_promotions FOR ALL
  USING (public.is_admin());

CREATE POLICY "Store managers manage network promotions" ON public.one_promotions FOR ALL
  USING (network_id = public.get_user_network_id(auth.uid()));

CREATE POLICY "ONE members view active promotions" ON public.one_promotions FOR SELECT
  USING (
    is_active = true 
    AND now() BETWEEN start_date AND end_date
    AND network_id IN (
      SELECT favorite_network_id FROM public.clients 
      WHERE user_id = auth.uid() AND is_one_member = true
    )
  );

-- Policies para one_promotion_products
CREATE POLICY "Admins manage promotion products" ON public.one_promotion_products FOR ALL
  USING (public.is_admin());

CREATE POLICY "Store managers manage own promotion products" ON public.one_promotion_products FOR ALL
  USING (
    promotion_id IN (
      SELECT id FROM public.one_promotions 
      WHERE network_id = public.get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Users view promotion products" ON public.one_promotion_products FOR SELECT
  USING (
    promotion_id IN (
      SELECT id FROM public.one_promotions 
      WHERE is_active = true 
      AND now() BETWEEN start_date AND end_date
    )
  );

-- Policies para one_promotion_stores
CREATE POLICY "Admins manage promotion stores" ON public.one_promotion_stores FOR ALL
  USING (public.is_admin());

CREATE POLICY "Store managers manage own promotion stores" ON public.one_promotion_stores FOR ALL
  USING (
    promotion_id IN (
      SELECT id FROM public.one_promotions 
      WHERE network_id = public.get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Users view promotion stores" ON public.one_promotion_stores FOR SELECT
  USING (
    promotion_id IN (
      SELECT id FROM public.one_promotions 
      WHERE is_active = true
    )
  );

-- Policies para one_promotion_redemptions
CREATE POLICY "Admins view all redemptions" ON public.one_promotion_redemptions FOR ALL
  USING (public.is_admin());

CREATE POLICY "Store managers view network redemptions" ON public.one_promotion_redemptions FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM public.stores 
      WHERE network_id = public.get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Clients view own redemptions" ON public.one_promotion_redemptions FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Policies para network_one_commission_config
CREATE POLICY "Admins manage commission config" ON public.network_one_commission_config FOR ALL
  USING (public.is_admin());

CREATE POLICY "Store managers view own commission config" ON public.network_one_commission_config FOR SELECT
  USING (network_id = public.get_user_network_id(auth.uid()));

-- 1.5 Triggers e Functions

-- Atualizar status de membro ONE automaticamente
CREATE OR REPLACE FUNCTION public.update_client_one_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    UPDATE public.clients SET 
      is_one_member = true,
      one_member_since = COALESCE(one_member_since, now())
    WHERE id = NEW.client_id;
  ELSIF NEW.status IN ('cancelled', 'suspended') AND OLD.status = 'active' THEN
    UPDATE public.clients SET is_one_member = false
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_one_status
  AFTER INSERT OR UPDATE ON public.client_subscriptions_one
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_one_status();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_subscriptions_one_updated_at
  BEFORE UPDATE ON public.client_subscriptions_one
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_one_promotions_updated_at
  BEFORE UPDATE ON public.one_promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_network_one_commission_config_updated_at
  BEFORE UPDATE ON public.network_one_commission_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Incrementar contador de resgates
CREATE OR REPLACE FUNCTION public.increment_promotion_redemptions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.one_promotions 
  SET current_redemptions = current_redemptions + 1
  WHERE id = NEW.promotion_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_increment_redemptions
  AFTER INSERT ON public.one_promotion_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_promotion_redemptions();

-- Function para verificar se promoção atingiu limite
CREATE OR REPLACE FUNCTION public.check_promotion_limit()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promo_record RECORD;
BEGIN
  SELECT * INTO promo_record 
  FROM public.one_promotions 
  WHERE id = NEW.promotion_id;
  
  IF promo_record.max_redemptions IS NOT NULL 
     AND promo_record.current_redemptions >= promo_record.max_redemptions THEN
    RAISE EXCEPTION 'Promoção atingiu o limite de resgates';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_promotion_limit
  BEFORE INSERT ON public.one_promotion_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_promotion_limit();