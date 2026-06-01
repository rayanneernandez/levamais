-- Corrigir vazamento de informação da tabela system_menus
-- Remover policy que permite acesso público
DROP POLICY IF EXISTS "Everyone can view system menus" ON system_menus;

-- Criar nova policy restrita apenas para admins
CREATE POLICY "Only admins can view system menus"
  ON system_menus
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));