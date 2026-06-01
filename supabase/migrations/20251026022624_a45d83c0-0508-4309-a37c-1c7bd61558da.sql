-- Criar tabela de templates de checklist
CREATE TABLE project_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('store', 'management')),
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de itens dos templates
CREATE TABLE project_checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_checklist_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de progresso dos checklists
CREATE TABLE project_checklist_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  template_id uuid REFERENCES project_checklist_templates(id) ON DELETE CASCADE,
  store_id uuid,
  template_item_id uuid REFERENCES project_checklist_template_items(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, template_item_id, store_id)
);

-- Habilitar RLS
ALTER TABLE project_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_checklist_progress ENABLE ROW LEVEL SECURITY;

-- Policies para templates
CREATE POLICY "Admins can manage templates" ON project_checklist_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view active templates" ON project_checklist_templates
  FOR SELECT USING (is_active = true);

-- Policies para itens dos templates
CREATE POLICY "Admins can manage template items" ON project_checklist_template_items
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view template items" ON project_checklist_template_items
  FOR SELECT USING (true);

-- Policies para progresso
CREATE POLICY "Admins can manage progress" ON project_checklist_progress
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view project progress" ON project_checklist_progress
  FOR SELECT USING (true);

CREATE POLICY "Users can update progress" ON project_checklist_progress
  FOR UPDATE USING (true);

-- Inserir template de checklist por loja
INSERT INTO project_checklist_templates (name, type, description)
VALUES ('Checklist de Implantação por Loja', 'store', 'Checklist de atividades para cada loja do projeto');

-- Inserir itens do checklist por loja
WITH template AS (
  SELECT id FROM project_checklist_templates WHERE type = 'store' LIMIT 1
)
INSERT INTO project_checklist_template_items (template_id, title, order_index)
SELECT id, 'Integração webPosto Pista', 1 FROM template
UNION ALL
SELECT id, 'Integração webPosto Loja', 2 FROM template
UNION ALL
SELECT id, 'Treinamento Atendente', 3 FROM template
UNION ALL
SELECT id, 'Treinamento Frentista', 4 FROM template;

-- Inserir template gerencial
INSERT INTO project_checklist_templates (name, type, description)
VALUES ('Checklist Gerencial', 'management', 'Checklist de treinamento dos módulos do sistema');

-- Inserir itens do checklist gerencial
WITH template AS (
  SELECT id FROM project_checklist_templates WHERE type = 'management' LIMIT 1
)
INSERT INTO project_checklist_template_items (template_id, title, order_index)
SELECT id, 'Fidelidade', 1 FROM template
UNION ALL
SELECT id, 'Transações', 2 FROM template
UNION ALL
SELECT id, 'Clientes', 3 FROM template
UNION ALL
SELECT id, 'Planos', 4 FROM template
UNION ALL
SELECT id, 'Relatórios', 5 FROM template
UNION ALL
SELECT id, 'Dashboard', 6 FROM template;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_project_checklist_templates_updated_at
  BEFORE UPDATE ON project_checklist_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_checklist_progress_updated_at
  BEFORE UPDATE ON project_checklist_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();