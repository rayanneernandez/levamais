-- Add tutorial_completed column to store_managers table
ALTER TABLE public.store_managers 
ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN public.store_managers.tutorial_completed IS 'Flag para indicar se o usuário completou o tutorial interativo do portal';