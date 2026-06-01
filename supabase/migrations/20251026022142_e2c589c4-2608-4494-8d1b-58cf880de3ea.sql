-- Criar políticas RLS para a tabela projects
-- Permitir que admins gerenciem todos os projetos
CREATE POLICY "Admins podem gerenciar projetos"
  ON projects
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Permitir que network managers vejam projetos da própria rede
CREATE POLICY "Network managers podem ver projetos da rede"
  ON projects
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );