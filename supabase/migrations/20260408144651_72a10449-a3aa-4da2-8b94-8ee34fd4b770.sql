
-- 1. Fix manual_categories: Restrict write to admins, keep read for authenticated
DROP POLICY IF EXISTS "Authenticated users can manage manual categories" ON public.manual_categories;

CREATE POLICY "Anyone authenticated can read manual categories"
ON public.manual_categories FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage manual categories"
ON public.manual_categories FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Fix manual_articles: Restrict write to admins, keep read for authenticated
DROP POLICY IF EXISTS "Authenticated users can manage manual articles" ON public.manual_articles;

CREATE POLICY "Anyone authenticated can read manual articles"
ON public.manual_articles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage manual articles"
ON public.manual_articles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. Fix storage: manual-videos upload/delete restricted to admins
DROP POLICY IF EXISTS "Admins podem fazer upload de vídeos" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem deletar vídeos" ON storage.objects;

CREATE POLICY "Admins podem fazer upload de vídeos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'manual-videos' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar vídeos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'manual-videos' AND has_role(auth.uid(), 'admin'));

-- 4. Fix storage: reward-images upload restricted to network managers or admins
DROP POLICY IF EXISTS "Permitir upload de imagens de prêmios" ON storage.objects;

CREATE POLICY "Network managers or admins can upload reward images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reward-images' AND (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'network_manager')
  )
);
