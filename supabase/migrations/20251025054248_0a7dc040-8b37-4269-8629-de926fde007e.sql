-- Adicionar novos campos à tabela budgets
ALTER TABLE public.budgets 
ADD COLUMN cnpjs TEXT[] DEFAULT '{}',
ADD COLUMN observations TEXT,
ADD COLUMN payment_type TEXT CHECK (payment_type IN ('boleto', 'pix')),
ADD COLUMN products_installments_count INTEGER DEFAULT 1,
ADD COLUMN unique_services_installments_count INTEGER DEFAULT 1;