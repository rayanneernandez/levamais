-- Adicionar campos na tabela transactions para capturar dados do WebPosto
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS codigo_produto TEXT,
ADD COLUMN IF NOT EXISTS codigo_colaborador TEXT,
ADD COLUMN IF NOT EXISTS nome_colaborador TEXT;

-- Criar tabela para configuração de acúmulo diferenciado por produto
CREATE TABLE IF NOT EXISTS public.fuel_differential_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  differential_percentage NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(network_id, product_code)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fuel_differential_config_network 
  ON public.fuel_differential_config(network_id);
  
CREATE INDEX IF NOT EXISTS idx_fuel_differential_config_product 
  ON public.fuel_differential_config(network_id, product_code) 
  WHERE is_active = true;

-- RLS Policies
ALTER TABLE public.fuel_differential_config ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar tudo
CREATE POLICY "Admins can manage fuel differential config"
  ON public.fuel_differential_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Network managers podem ver configurações da própria rede
CREATE POLICY "Network managers can view own network fuel config"
  ON public.fuel_differential_config FOR SELECT
  USING (
    public.has_role(auth.uid(), 'network_manager') 
    AND network_id = public.get_user_network_id(auth.uid())
  );

-- Network managers podem criar configurações para própria rede
CREATE POLICY "Network managers can create own network fuel config"
  ON public.fuel_differential_config FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'network_manager') 
    AND network_id = public.get_user_network_id(auth.uid())
  );

-- Network managers podem atualizar configurações da própria rede
CREATE POLICY "Network managers can update own network fuel config"
  ON public.fuel_differential_config FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'network_manager') 
    AND network_id = public.get_user_network_id(auth.uid())
  );

-- Network managers podem deletar configurações da própria rede
CREATE POLICY "Network managers can delete own network fuel config"
  ON public.fuel_differential_config FOR DELETE
  USING (
    public.has_role(auth.uid(), 'network_manager') 
    AND network_id = public.get_user_network_id(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_fuel_differential_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fuel_differential_config_updated_at
  BEFORE UPDATE ON public.fuel_differential_config
  FOR EACH ROW
  EXECUTE FUNCTION update_fuel_differential_config_updated_at();

-- Comentários
COMMENT ON TABLE public.fuel_differential_config IS 'Configuração de acúmulo diferenciado por código de produto';
COMMENT ON COLUMN public.fuel_differential_config.product_code IS 'Código do produto no WebPosto';
COMMENT ON COLUMN public.fuel_differential_config.product_name IS 'Nome do combustível (ex: GASOLINA COMUM)';
COMMENT ON COLUMN public.fuel_differential_config.differential_percentage IS 'Percentual diferenciado (ex: 2.0 = 2%)';