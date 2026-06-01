-- Adicionar campos de horário e limites por cliente em one_promotions
ALTER TABLE public.one_promotions
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS max_redemptions_per_client integer,
  ADD COLUMN IF NOT EXISTS redemption_period_type text CHECK (redemption_period_type IN ('per_day', 'per_week', 'per_month', 'per_custom_months')),
  ADD COLUMN IF NOT EXISTS redemption_period_months integer,
  ADD COLUMN IF NOT EXISTS buy_quantity integer,
  ADD COLUMN IF NOT EXISTS get_quantity integer,
  ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS combo_price numeric(10,2);

-- Criar tabela de controle de resgates por cliente para limites periódicos
CREATE TABLE IF NOT EXISTS public.one_promotion_client_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES public.one_promotions(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  redemptions_count integer DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, client_id, period_start)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_one_promo_client_redemptions_promo ON public.one_promotion_client_redemptions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_one_promo_client_redemptions_client ON public.one_promotion_client_redemptions(client_id);
CREATE INDEX IF NOT EXISTS idx_one_promo_client_redemptions_period ON public.one_promotion_client_redemptions(period_start, period_end);

-- RLS para one_promotion_client_redemptions
ALTER TABLE public.one_promotion_client_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client redemptions" ON public.one_promotion_client_redemptions FOR ALL
  USING (public.is_admin());

CREATE POLICY "Store managers view network client redemptions" ON public.one_promotion_client_redemptions FOR SELECT
  USING (
    promotion_id IN (
      SELECT id FROM public.one_promotions 
      WHERE network_id = public.get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Clients view own redemption counts" ON public.one_promotion_client_redemptions FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_one_promotion_client_redemptions_updated_at
  BEFORE UPDATE ON public.one_promotion_client_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();