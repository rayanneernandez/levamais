-- Tabela de promoções de combustível
CREATE TABLE IF NOT EXISTS public.fuel_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  fuel_config_id UUID NOT NULL REFERENCES public.fuel_differential_config(id) ON DELETE CASCADE,
  promotion_name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  original_percentage NUMERIC NOT NULL,
  promotion_percentage NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS policies
ALTER TABLE public.fuel_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fuel promotions"
  ON public.fuel_promotions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own network fuel promotions"
  ON public.fuel_promotions
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can create own network fuel promotions"
  ON public.fuel_promotions
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can update own network fuel promotions"
  ON public.fuel_promotions
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can delete own network fuel promotions"
  ON public.fuel_promotions
  FOR DELETE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

-- Índices
CREATE INDEX idx_fuel_promotions_network ON public.fuel_promotions(network_id);
CREATE INDEX idx_fuel_promotions_dates ON public.fuel_promotions(start_date, end_date);
CREATE INDEX idx_fuel_promotions_active ON public.fuel_promotions(is_active);

-- Trigger para updated_at
CREATE TRIGGER set_fuel_promotions_updated_at
  BEFORE UPDATE ON public.fuel_promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();