-- Criar tabela de comissões de revendas
CREATE TABLE public.reseller_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  commission_month DATE NOT NULL,
  monthly_fee NUMERIC NOT NULL,
  commission_percentage NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'paid', 'cancelled'))
);

-- Habilitar RLS
ALTER TABLE public.reseller_commissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para admins
CREATE POLICY "Admins can manage all commissions"
  ON public.reseller_commissions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_reseller_commissions_updated_at
  BEFORE UPDATE ON public.reseller_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_reseller_commissions_reseller_id ON public.reseller_commissions(reseller_id);
CREATE INDEX idx_reseller_commissions_network_id ON public.reseller_commissions(network_id);
CREATE INDEX idx_reseller_commissions_month ON public.reseller_commissions(commission_month);
CREATE INDEX idx_reseller_commissions_status ON public.reseller_commissions(status);

-- Criar tabela de regras de comissão
CREATE TABLE public.reseller_commission_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  first_three_months_percentage NUMERIC NOT NULL DEFAULT 50,
  after_three_months_percentage NUMERIC NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.reseller_commission_rules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage commission rules"
  ON public.reseller_commission_rules
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_reseller_commission_rules_updated_at
  BEFORE UPDATE ON public.reseller_commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir regra padrão para 2025
INSERT INTO public.reseller_commission_rules (
  rule_name,
  start_date,
  end_date,
  first_three_months_percentage,
  after_three_months_percentage
) VALUES (
  'Regra 2025',
  '2025-01-01',
  '2025-12-31',
  50,
  15
);

-- Inserir regra para 2026 (será configurada depois)
INSERT INTO public.reseller_commission_rules (
  rule_name,
  start_date,
  end_date,
  first_three_months_percentage,
  after_three_months_percentage,
  is_active
) VALUES (
  'Regra 2026',
  '2026-01-01',
  NULL,
  0,
  0,
  false
);