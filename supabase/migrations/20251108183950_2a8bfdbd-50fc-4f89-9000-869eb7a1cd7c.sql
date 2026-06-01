
-- Criar política para clientes poderem criar suas próprias assinaturas ONE
CREATE POLICY "Clients can create own ONE subscription"
ON client_subscriptions_one
FOR INSERT
TO public
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
);

-- Criar política para clientes atualizarem suas próprias assinaturas ONE
CREATE POLICY "Clients can update own ONE subscription"
ON client_subscriptions_one
FOR UPDATE
TO public
USING (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
);
