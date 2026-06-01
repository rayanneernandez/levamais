-- Criar tabela de projetos
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  network_id UUID REFERENCES public.networks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'planning',
  start_date DATE NOT NULL,
  deadline DATE NOT NULL,
  budget_value NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (deadline >= start_date)
);

-- Criar tabela de tarefas do projeto
CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies para projects
CREATE POLICY "Admins can manage all projects"
  ON public.projects
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Commercial users can view projects"
  ON public.projects
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    (SELECT is_commercial FROM profiles WHERE id = auth.uid()) = true
  );

-- RLS Policies para project_tasks
CREATE POLICY "Admins can manage all tasks"
  ON public.project_tasks
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view tasks from their projects"
  ON public.project_tasks
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_tasks.project_id 
      AND projects.created_by = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_projects_network_id ON public.projects(network_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON public.project_tasks(status);