-- Adicionar campo de progresso aos projetos
ALTER TABLE public.projects
ADD COLUMN progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

-- Adicionar coluna para preferência de visualização (lista ou kanban)
ALTER TABLE public.projects
ADD COLUMN view_preference TEXT DEFAULT 'list' CHECK (view_preference IN ('list', 'kanban'));