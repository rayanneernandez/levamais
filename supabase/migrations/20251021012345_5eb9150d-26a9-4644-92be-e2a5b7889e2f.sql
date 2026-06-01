-- Adicionar campo is_seller à tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_seller boolean DEFAULT false;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.profiles.is_seller IS 'Indica se o usuário é vendedor e pode ser atribuído a Leads e Orçamentos';