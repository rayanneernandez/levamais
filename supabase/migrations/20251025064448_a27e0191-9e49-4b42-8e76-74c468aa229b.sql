-- Adicionar campos de vencimento e email financeiro aos orçamentos
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS payment_due_days integer,
ADD COLUMN IF NOT EXISTS financial_email text;

COMMENT ON COLUMN public.budgets.payment_due_days IS 'Dias para vencimento: 5, 10 ou 15';
COMMENT ON COLUMN public.budgets.financial_email IS 'Email do departamento financeiro';