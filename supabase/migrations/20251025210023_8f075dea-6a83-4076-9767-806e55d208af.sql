-- Adicionar campo lead_id na tabela budgets para vincular ao lead
ALTER TABLE public.budgets 
ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX idx_budgets_lead_id ON public.budgets(lead_id);