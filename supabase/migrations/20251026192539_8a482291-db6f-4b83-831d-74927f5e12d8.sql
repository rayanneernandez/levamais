-- Criar tabela para regras de comissão dos revendedores
CREATE TABLE IF NOT EXISTS public.reseller_commission_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_start_date DATE NOT NULL,
  promotion_end_date DATE NOT NULL,
  initial_percentage NUMERIC NOT NULL DEFAULT 50.0,
  initial_months INTEGER NOT NULL DEFAULT 3,
  ongoing_percentage NUMERIC NOT NULL DEFAULT 15.0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.reseller_commission_rules ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar todas as regras
CREATE POLICY "Admins can manage all commission rules"
  ON public.reseller_commission_rules
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public pode visualizar regras ativas
CREATE POLICY "Public can view active commission rules"
  ON public.reseller_commission_rules
  FOR SELECT
  USING (is_active = true);