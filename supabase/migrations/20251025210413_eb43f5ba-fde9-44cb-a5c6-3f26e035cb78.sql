-- Alterar tempo de expiração dos códigos de verificação para 1 minuto
ALTER TABLE public.budget_verification_codes 
ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '1 minute');