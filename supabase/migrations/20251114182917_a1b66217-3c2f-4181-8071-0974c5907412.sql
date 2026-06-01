-- Criar bucket de storage para imagens de prêmios
INSERT INTO storage.buckets (id, name, public)
VALUES ('reward-images', 'reward-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket
CREATE POLICY "Permitir upload de imagens de prêmios"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reward-images');

CREATE POLICY "Permitir leitura pública de imagens de prêmios"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'reward-images');

CREATE POLICY "Permitir atualização de imagens de prêmios"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'reward-images');

CREATE POLICY "Permitir exclusão de imagens de prêmios"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'reward-images');