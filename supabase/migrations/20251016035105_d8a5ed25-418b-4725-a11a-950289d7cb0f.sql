-- Criar tabela para ações/campanhas de cashback
CREATE TABLE public.cashback_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cashback_multiplier NUMERIC NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de relacionamento entre campanhas e lojas
CREATE TABLE public.campaign_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.cashback_campaigns(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, store_id)
);

-- Habilitar RLS
ALTER TABLE public.cashback_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_stores ENABLE ROW LEVEL SECURITY;

-- Políticas para cashback_campaigns
CREATE POLICY "Network managers can view own campaigns"
ON public.cashback_campaigns
FOR SELECT
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can create campaigns"
ON public.cashback_campaigns
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can update own campaigns"
ON public.cashback_campaigns
FOR UPDATE
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can delete own campaigns"
ON public.cashback_campaigns
FOR DELETE
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND network_id = get_user_network_id(auth.uid())
);

-- Políticas para campaign_stores
CREATE POLICY "Network managers can view campaign stores"
ON public.campaign_stores
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cashback_campaigns c
    WHERE c.id = campaign_id
    AND c.network_id = get_user_network_id(auth.uid())
  )
);

CREATE POLICY "Network managers can manage campaign stores"
ON public.campaign_stores
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.cashback_campaigns c
    WHERE c.id = campaign_id
    AND c.network_id = get_user_network_id(auth.uid())
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_cashback_campaigns_updated_at
BEFORE UPDATE ON public.cashback_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();