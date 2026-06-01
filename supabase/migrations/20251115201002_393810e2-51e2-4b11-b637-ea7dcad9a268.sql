-- Criar tabela para configuração de recompensas por avaliação NPS
CREATE TABLE IF NOT EXISTS public.nps_rating_rewards_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('points', 'cashback_fixed', 'cashback_percentage')),
  reward_value NUMERIC NOT NULL CHECK (reward_value > 0),
  min_stars INTEGER CHECK (min_stars >= 1 AND min_stars <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(network_id)
);

-- Enable Row Level Security
ALTER TABLE public.nps_rating_rewards_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Network managers can view own network reward config" 
ON public.nps_rating_rewards_config 
FOR SELECT 
USING (
  network_id IN (
    SELECT network_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Network managers can create own network reward config" 
ON public.nps_rating_rewards_config 
FOR INSERT 
WITH CHECK (
  network_id IN (
    SELECT network_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Network managers can update own network reward config" 
ON public.nps_rating_rewards_config 
FOR UPDATE 
USING (
  network_id IN (
    SELECT network_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Network managers can delete own network reward config" 
ON public.nps_rating_rewards_config 
FOR DELETE 
USING (
  network_id IN (
    SELECT network_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Admins podem fazer tudo
CREATE POLICY "Admins can manage all reward configs" 
ON public.nps_rating_rewards_config 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Criar índice para melhor performance
CREATE INDEX idx_nps_rating_rewards_config_network_id ON public.nps_rating_rewards_config(network_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_nps_rating_rewards_config_updated_at
BEFORE UPDATE ON public.nps_rating_rewards_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela para rastrear bonificações aplicadas
CREATE TABLE IF NOT EXISTS public.nps_rating_rewards_applied (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rating_id UUID NOT NULL REFERENCES public.transaction_ratings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL,
  reward_value NUMERIC NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  transaction_id UUID,
  UNIQUE(rating_id)
);

-- Enable Row Level Security
ALTER TABLE public.nps_rating_rewards_applied ENABLE ROW LEVEL SECURITY;

-- Policies para nps_rating_rewards_applied
CREATE POLICY "Network managers can view own network applied rewards" 
ON public.nps_rating_rewards_applied 
FOR SELECT 
USING (
  network_id IN (
    SELECT network_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "System can insert applied rewards" 
ON public.nps_rating_rewards_applied 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Clients can view own applied rewards" 
ON public.nps_rating_rewards_applied 
FOR SELECT 
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all applied rewards" 
ON public.nps_rating_rewards_applied 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Criar índices
CREATE INDEX idx_nps_rating_rewards_applied_rating_id ON public.nps_rating_rewards_applied(rating_id);
CREATE INDEX idx_nps_rating_rewards_applied_client_id ON public.nps_rating_rewards_applied(client_id);
CREATE INDEX idx_nps_rating_rewards_applied_network_id ON public.nps_rating_rewards_applied(network_id);