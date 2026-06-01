-- Criar bucket para vídeos dos manuais
INSERT INTO storage.buckets (id, name, public)
VALUES ('manual-videos', 'manual-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
CREATE POLICY "Admins podem fazer upload de vídeos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'manual-videos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admins podem deletar vídeos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'manual-videos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Todos podem ver vídeos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'manual-videos');

-- Adicionar coluna para armazenar caminho do arquivo de vídeo
ALTER TABLE public.manual_articles
ADD COLUMN IF NOT EXISTS video_file_path TEXT;