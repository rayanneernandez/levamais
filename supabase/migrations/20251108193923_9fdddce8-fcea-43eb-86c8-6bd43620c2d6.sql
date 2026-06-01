-- Criar tabela para configuração de custos operacionais do Leva+ One
CREATE TABLE IF NOT EXISTS public.one_operational_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_percentage numeric NOT NULL DEFAULT 0 CHECK (tax_percentage >= 0 AND tax_percentage <= 100),
  card_fee_percentage numeric NOT NULL DEFAULT 0 CHECK (card_fee_percentage >= 0 AND card_fee_percentage <= 100),
  other_costs_percentage numeric NOT NULL DEFAULT 0 CHECK (other_costs_percentage >= 0 AND other_costs_percentage <= 100),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar índice para buscar configuração ativa
CREATE INDEX idx_one_operational_costs_active ON public.one_operational_costs(is_active) WHERE is_active = true;

-- Trigger para updated_at
CREATE TRIGGER set_one_operational_costs_updated_at
  BEFORE UPDATE ON public.one_operational_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.one_operational_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view operational costs"
  ON public.one_operational_costs
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert operational costs"
  ON public.one_operational_costs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update operational costs"
  ON public.one_operational_costs
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete operational costs"
  ON public.one_operational_costs
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Inserir configuração padrão
INSERT INTO public.one_operational_costs (
  tax_percentage,
  card_fee_percentage,
  other_costs_percentage,
  notes,
  is_active
) VALUES (
  6.0,
  3.5,
  0.0,
  'Configuração inicial: Impostos 6%, Taxa de cartão 3.5%',
  true
);