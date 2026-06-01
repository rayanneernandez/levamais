-- Tabela para configurar acúmulo de pontos diferenciado por produto
CREATE TABLE IF NOT EXISTS public.fuel_product_points_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  points_per_liter NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(network_id, product_name)
);

-- Habilita RLS
ALTER TABLE public.fuel_product_points_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage all fuel product configs"
ON public.fuel_product_points_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own network fuel configs"
ON public.fuel_product_points_config
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND 
  network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can create own network fuel configs"
ON public.fuel_product_points_config
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'network_manager'::app_role) AND 
  network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can update own network fuel configs"
ON public.fuel_product_points_config
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND 
  network_id = get_user_network_id(auth.uid())
);

CREATE POLICY "Network managers can delete own network fuel configs"
ON public.fuel_product_points_config
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) AND 
  network_id = get_user_network_id(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_fuel_product_points_config_updated_at
BEFORE UPDATE ON public.fuel_product_points_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_fuel_product_points_config_network_id 
ON public.fuel_product_points_config(network_id);

CREATE INDEX idx_fuel_product_points_config_active 
ON public.fuel_product_points_config(network_id, is_active) 
WHERE is_active = true;