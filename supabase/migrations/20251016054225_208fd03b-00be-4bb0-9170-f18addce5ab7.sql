-- Criar tabela de logs de ajustes de saldo
CREATE TABLE public.balance_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  adjusted_by UUID NOT NULL,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('cashback', 'points')),
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_balance_adjustments_client_id ON public.balance_adjustments(client_id);
CREATE INDEX idx_balance_adjustments_network_id ON public.balance_adjustments(network_id);
CREATE INDEX idx_balance_adjustments_created_at ON public.balance_adjustments(created_at);

-- Enable RLS
ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Network managers can view own network adjustments"
ON public.balance_adjustments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager') 
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can create adjustments"
ON public.balance_adjustments
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'network_manager') 
  AND network_id = get_user_network_id(auth.uid())
  AND adjusted_by = auth.uid()
);

CREATE POLICY "Admins can view all adjustments"
ON public.balance_adjustments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.balance_adjustments IS 'Registra ajustes manuais de saldo (cashback/pontos) realizados pelos gerentes de rede';