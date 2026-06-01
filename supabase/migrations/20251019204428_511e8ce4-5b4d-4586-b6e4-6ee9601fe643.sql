-- Criar tabela para mapear produtos similares
CREATE TABLE IF NOT EXISTS public.product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  original_product_code TEXT NOT NULL,
  original_product_name TEXT NOT NULL,
  normalized_product_name TEXT NOT NULL,
  normalized_product_code TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(network_id, original_product_code)
);

-- Índices para performance
CREATE INDEX idx_product_mappings_network ON product_mappings(network_id);
CREATE INDEX idx_product_mappings_normalized ON product_mappings(normalized_product_name);
CREATE INDEX idx_product_mappings_original ON product_mappings(original_product_code);

-- RLS Policies
ALTER TABLE public.product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all product mappings"
  ON public.product_mappings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own network mappings"
  ON public.product_mappings
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can create own network mappings"
  ON public.product_mappings
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Network managers can update own network mappings"
  ON public.product_mappings
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can delete own network mappings"
  ON public.product_mappings
  FOR DELETE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

-- Trigger para updated_at
CREATE TRIGGER update_product_mappings_updated_at
  BEFORE UPDATE ON public.product_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para normalizar nome de produto automaticamente
CREATE OR REPLACE FUNCTION normalize_product_name(product_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Remove espaços extras, converte para maiúsculas, remove caracteres especiais
  RETURN UPPER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(product_name),
        '\s+', ' ', 'g'  -- substitui múltiplos espaços por um
      ),
      '[^A-Z0-9\s]', '', 'gi'  -- remove caracteres especiais
    )
  );
END;
$$;