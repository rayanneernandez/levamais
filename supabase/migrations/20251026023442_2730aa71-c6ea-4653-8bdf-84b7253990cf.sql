-- Adicionar colunas às tarefas de projeto
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS due_date timestamptz,
ADD COLUMN IF NOT EXISTS due_time time,
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS notes text;

-- Criar tabela de agenda/reuniões
CREATE TABLE project_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  meeting_date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  location text,
  meeting_type text DEFAULT 'presencial' CHECK (meeting_type IN ('presencial', 'online', 'hibrido')),
  meeting_link text,
  attendees uuid[] DEFAULT '{}',
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE project_meetings ENABLE ROW LEVEL SECURITY;

-- Policies para reuniões
CREATE POLICY "Admins can manage meetings" ON project_meetings
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view project meetings" ON project_meetings
  FOR SELECT USING (true);

CREATE POLICY "Users can create meetings" ON project_meetings
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own meetings" ON project_meetings
  FOR UPDATE USING (created_by = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_project_meetings_updated_at
  BEFORE UPDATE ON project_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();