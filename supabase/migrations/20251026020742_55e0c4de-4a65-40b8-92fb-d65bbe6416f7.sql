-- Criar tabela de check-ins de sucesso do cliente
CREATE TABLE IF NOT EXISTS customer_success_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  checkin_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_for DATE,
  description TEXT,
  performed_by UUID REFERENCES auth.users(id),
  active_stores INTEGER,
  active_clients INTEGER,
  total_transactions INTEGER,
  transaction_volume NUMERIC(12,2),
  client_satisfaction INTEGER CHECK (client_satisfaction BETWEEN 1 AND 5),
  observations TEXT,
  insights TEXT,
  action_items TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_checkins_project ON customer_success_checkins(project_id);
CREATE INDEX IF NOT EXISTS idx_checkins_status ON customer_success_checkins(status);
CREATE INDEX IF NOT EXISTS idx_checkins_scheduled ON customer_success_checkins(scheduled_for);

-- Habilitar RLS
ALTER TABLE customer_success_checkins ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar check-ins"
  ON customer_success_checkins
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem visualizar check-ins de projetos que têm acesso"
  ON customer_success_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = customer_success_checkins.project_id
    )
  );

-- Criar função para gerar automaticamente os 3 encontros do projeto
CREATE OR REPLACE FUNCTION create_project_scheduled_checkins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- D1 - Implantação (na data de início)
  INSERT INTO customer_success_checkins (
    project_id,
    checkin_date,
    checkin_type,
    status,
    scheduled_for,
    description
  ) VALUES (
    NEW.id,
    NEW.start_date,
    'implantacao',
    'scheduled',
    NEW.start_date,
    'D1 - Encontro de Implantação'
  );

  -- D45 - Pós-venda (45 dias após início)
  INSERT INTO customer_success_checkins (
    project_id,
    checkin_date,
    checkin_type,
    status,
    scheduled_for,
    description
  ) VALUES (
    NEW.id,
    NEW.start_date + INTERVAL '45 days',
    'pos_venda',
    'scheduled',
    NEW.start_date + INTERVAL '45 days',
    'D45 - Pós-venda e acompanhamento'
  );

  -- D90 - Avaliação de desempenho (90 dias após início)
  INSERT INTO customer_success_checkins (
    project_id,
    checkin_date,
    checkin_type,
    status,
    scheduled_for,
    description
  ) VALUES (
    NEW.id,
    NEW.start_date + INTERVAL '90 days',
    'avaliacao_desempenho',
    'scheduled',
    NEW.start_date + INTERVAL '90 days',
    'D90 - Avaliação de desempenho e continuidade'
  );

  RETURN NEW;
END;
$$;

-- Criar trigger para executar após inserção de projeto
DROP TRIGGER IF EXISTS trigger_create_scheduled_checkins ON projects;
CREATE TRIGGER trigger_create_scheduled_checkins
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_scheduled_checkins();