-- Tabela de tags disponíveis
CREATE TABLE IF NOT EXISTS public.user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(network_id, name)
);

-- Tabela de relacionamento usuário-tag
CREATE TABLE IF NOT EXISTS public.store_manager_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_manager_id UUID NOT NULL REFERENCES public.store_managers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.user_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(store_manager_id, tag_id)
);

-- RLS para user_tags
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all tags"
  ON public.user_tags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own network tags"
  ON public.user_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can create own network tags"
  ON public.user_tags
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can update own network tags"
  ON public.user_tags
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can delete own network tags"
  ON public.user_tags
  FOR DELETE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

-- RLS para store_manager_tags
ALTER TABLE public.store_manager_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all manager tags"
  ON public.store_manager_tags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own network manager tags"
  ON public.store_manager_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM store_managers sm
      WHERE sm.id = store_manager_tags.store_manager_id
      AND sm.network_id = get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Network managers can create own network manager tags"
  ON public.store_manager_tags
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM store_managers sm
      WHERE sm.id = store_manager_tags.store_manager_id
      AND sm.network_id = get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Network managers can delete own network manager tags"
  ON public.store_manager_tags
  FOR DELETE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM store_managers sm
      WHERE sm.id = store_manager_tags.store_manager_id
      AND sm.network_id = get_user_network_id(auth.uid())
    )
  );

-- Índices
CREATE INDEX idx_user_tags_network ON public.user_tags(network_id);
CREATE INDEX idx_store_manager_tags_manager ON public.store_manager_tags(store_manager_id);
CREATE INDEX idx_store_manager_tags_tag ON public.store_manager_tags(tag_id);

-- Trigger para updated_at
CREATE TRIGGER set_user_tags_updated_at
  BEFORE UPDATE ON public.user_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();