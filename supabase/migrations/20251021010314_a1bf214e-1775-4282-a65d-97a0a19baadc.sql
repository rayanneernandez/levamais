-- Criar tabela de leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  temperature TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  assigned_to UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);

-- Habilitar RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para admins
CREATE POLICY "Admins can manage all leads"
ON public.leads
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para usuários comerciais
CREATE POLICY "Commercial users can view all leads"
ON public.leads
FOR SELECT
USING (
  (SELECT is_commercial FROM profiles WHERE id = auth.uid()) = true
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Commercial users can update leads"
ON public.leads
FOR UPDATE
USING (
  (SELECT is_commercial FROM profiles WHERE id = auth.uid()) = true
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Commercial users can create leads"
ON public.leads
FOR INSERT
WITH CHECK (
  (SELECT is_commercial FROM profiles WHERE id = auth.uid()) = true
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();