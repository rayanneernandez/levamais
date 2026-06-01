-- Tornar coluna email da tabela networks opcional (nullable)
ALTER TABLE public.networks ALTER COLUMN email DROP NOT NULL;