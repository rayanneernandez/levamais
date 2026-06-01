-- Criar tabela para configurações de respostas automáticas do NPS
CREATE TABLE IF NOT EXISTS public.nps_auto_reply_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  auto_reply_message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(network_id, stars)
);

-- Enable Row Level Security
ALTER TABLE public.nps_auto_reply_rules ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their network's NPS auto reply rules" 
ON public.nps_auto_reply_rules 
FOR SELECT 
USING (
  network_id IN (
    SELECT network_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create NPS auto reply rules for their network" 
ON public.nps_auto_reply_rules 
FOR INSERT 
WITH CHECK (
  network_id IN (
    SELECT network_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their network's NPS auto reply rules" 
ON public.nps_auto_reply_rules 
FOR UPDATE 
USING (
  network_id IN (
    SELECT network_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their network's NPS auto reply rules" 
ON public.nps_auto_reply_rules 
FOR DELETE 
USING (
  network_id IN (
    SELECT network_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Criar índice para melhor performance
CREATE INDEX idx_nps_auto_reply_rules_network_id ON public.nps_auto_reply_rules(network_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_nps_auto_reply_rules_updated_at
BEFORE UPDATE ON public.nps_auto_reply_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();