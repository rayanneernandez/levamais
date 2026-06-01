-- Create tables for documentation system
CREATE TABLE IF NOT EXISTS public.manual_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('client', 'store', 'collaborator')),
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manual_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.manual_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  video_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manual_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_articles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage (admin access already protected at route level)
CREATE POLICY "Authenticated users can manage manual categories"
ON public.manual_categories
FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage manual articles"
ON public.manual_articles
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Everyone can view published content
CREATE POLICY "Anyone can view manual categories"
ON public.manual_categories
FOR SELECT
USING (true);

CREATE POLICY "Anyone can view published manual articles"
ON public.manual_articles
FOR SELECT
USING (is_published = true);

-- Create indexes for better performance
CREATE INDEX idx_manual_categories_portal_type ON public.manual_categories(portal_type);
CREATE INDEX idx_manual_categories_order ON public.manual_categories(order_index);
CREATE INDEX idx_manual_articles_category ON public.manual_articles(category_id);
CREATE INDEX idx_manual_articles_order ON public.manual_articles(order_index);

-- Trigger for updated_at
CREATE TRIGGER update_manual_categories_updated_at
BEFORE UPDATE ON public.manual_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_manual_articles_updated_at
BEFORE UPDATE ON public.manual_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();