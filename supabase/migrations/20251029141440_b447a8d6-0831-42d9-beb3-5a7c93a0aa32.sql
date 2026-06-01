-- Adicionar coluna project_number se não existir
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_number TEXT;

-- Criar sequência para números de projeto
CREATE SEQUENCE IF NOT EXISTS project_number_seq START WITH 1;

-- Criar função para gerar número de projeto
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT nextval('project_number_seq') INTO next_num;
  RETURN 'PRJ-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- Criar trigger para gerar número de projeto automaticamente
CREATE OR REPLACE FUNCTION set_project_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_number IS NULL OR NEW.project_number = '' THEN
    NEW.project_number := generate_project_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_project_number ON projects;
CREATE TRIGGER trigger_set_project_number
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_project_number();

-- Atualizar projetos existentes sem número
UPDATE projects 
SET project_number = generate_project_number()
WHERE project_number IS NULL OR project_number = '';