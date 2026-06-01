-- Adicionar políticas RLS para permitir INSERT/UPDATE nas edge functions
-- As edge functions usam service role key que precisa de permissões explícitas

-- Permitir INSERT de transações (usado pela função venda-validar)
CREATE POLICY "Service role can insert transactions"
ON webposto_transactions
FOR INSERT
TO service_role
WITH CHECK (true);

-- Permitir UPDATE de transações (usado pela função venda-enviar)
CREATE POLICY "Service role can update transactions"
ON webposto_transactions
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);