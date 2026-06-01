
-- expo_push_tokens: Restringir INSERT e UPDATE via client_id do próprio usuário
CREATE POLICY "Users can insert own expo tokens" ON public.expo_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own expo tokens" ON public.expo_push_tokens
  FOR UPDATE TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
