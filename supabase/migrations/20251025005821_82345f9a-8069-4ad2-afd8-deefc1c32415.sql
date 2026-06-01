-- Tabela de regras de pontuação por rede
CREATE TABLE IF NOT EXISTS public.attendant_points_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  points_per_client NUMERIC NOT NULL DEFAULT 10,
  multiplier_7_days NUMERIC NOT NULL DEFAULT 1.5,
  multiplier_15_days NUMERIC NOT NULL DEFAULT 2.0,
  multiplier_30_days NUMERIC NOT NULL DEFAULT 3.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(network_id)
);

-- Tabela de prêmios/produtos do marketplace
CREATE TABLE IF NOT EXISTS public.attendant_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_cost NUMERIC NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('product', 'bonus', 'service')),
  image_url TEXT,
  stock_quantity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pontos dos atendentes
CREATE TABLE IF NOT EXISTS public.attendant_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  total_points NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(attendant_id, network_id)
);

-- Tabela de transações de pontos
CREATE TABLE IF NOT EXISTS public.attendant_points_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  points_earned NUMERIC NOT NULL,
  multiplier_applied NUMERIC NOT NULL DEFAULT 1,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('client_registration', 'client_return_7', 'client_return_15', 'client_return_30', 'manual_adjustment', 'redemption')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de resgates
CREATE TABLE IF NOT EXISTS public.attendant_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.attendant_rewards(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  points_spent NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'delivered', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.attendant_points_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendant_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendant_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendant_points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendant_redemptions ENABLE ROW LEVEL SECURITY;

-- Policies para attendant_points_rules
CREATE POLICY "Network managers can manage own rules"
  ON public.attendant_points_rules FOR ALL
  USING (has_role(auth.uid(), 'network_manager'::app_role) AND network_id = get_user_network_id(auth.uid()));

CREATE POLICY "Attendants can view rules"
  ON public.attendant_points_rules FOR SELECT
  USING (network_id IN (
    SELECT network_id FROM store_managers WHERE user_id = auth.uid() AND is_attendant = true
  ));

-- Policies para attendant_rewards
CREATE POLICY "Network managers can manage own rewards"
  ON public.attendant_rewards FOR ALL
  USING (has_role(auth.uid(), 'network_manager'::app_role) AND network_id = get_user_network_id(auth.uid()));

CREATE POLICY "Attendants can view active rewards"
  ON public.attendant_rewards FOR SELECT
  USING (is_active = true AND network_id IN (
    SELECT network_id FROM store_managers WHERE user_id = auth.uid() AND is_attendant = true
  ));

-- Policies para attendant_points
CREATE POLICY "Attendants can view own points"
  ON public.attendant_points FOR SELECT
  USING (attendant_id = auth.uid());

CREATE POLICY "Network managers can view network attendants points"
  ON public.attendant_points FOR SELECT
  USING (has_role(auth.uid(), 'network_manager'::app_role) AND network_id = get_user_network_id(auth.uid()));

CREATE POLICY "System can update attendant points"
  ON public.attendant_points FOR ALL
  USING (true);

-- Policies para attendant_points_transactions
CREATE POLICY "Attendants can view own transactions"
  ON public.attendant_points_transactions FOR SELECT
  USING (attendant_id = auth.uid());

CREATE POLICY "Network managers can view network transactions"
  ON public.attendant_points_transactions FOR SELECT
  USING (has_role(auth.uid(), 'network_manager'::app_role) AND network_id = get_user_network_id(auth.uid()));

CREATE POLICY "System can create transactions"
  ON public.attendant_points_transactions FOR INSERT
  WITH CHECK (true);

-- Policies para attendant_redemptions
CREATE POLICY "Attendants can create own redemptions"
  ON public.attendant_redemptions FOR INSERT
  WITH CHECK (attendant_id = auth.uid());

CREATE POLICY "Attendants can view own redemptions"
  ON public.attendant_redemptions FOR SELECT
  USING (attendant_id = auth.uid());

CREATE POLICY "Network managers can manage network redemptions"
  ON public.attendant_redemptions FOR ALL
  USING (has_role(auth.uid(), 'network_manager'::app_role) AND network_id = get_user_network_id(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_attendant_points_rules_updated_at
  BEFORE UPDATE ON public.attendant_points_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendant_rewards_updated_at
  BEFORE UPDATE ON public.attendant_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendant_points_updated_at
  BEFORE UPDATE ON public.attendant_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendant_redemptions_updated_at
  BEFORE UPDATE ON public.attendant_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();