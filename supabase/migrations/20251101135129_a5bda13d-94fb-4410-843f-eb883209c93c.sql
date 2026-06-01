-- Tabela para armazenar dados de preços de combustíveis da ANP
CREATE TABLE public.fuel_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL,
  razao_social TEXT,
  nome_fantasia TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cep TEXT,
  municipio TEXT,
  estado TEXT,
  bandeira TEXT,
  produto TEXT NOT NULL,
  unidade_medida TEXT,
  preco_revenda NUMERIC(10, 3),
  data_coleta DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_fuel_prices_cnpj ON public.fuel_prices(cnpj);
CREATE INDEX idx_fuel_prices_municipio ON public.fuel_prices(municipio);
CREATE INDEX idx_fuel_prices_estado ON public.fuel_prices(estado);
CREATE INDEX idx_fuel_prices_produto ON public.fuel_prices(produto);
CREATE INDEX idx_fuel_prices_data_coleta ON public.fuel_prices(data_coleta);

-- Tabela para controle de importações
CREATE TABLE public.fuel_price_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imported_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  successful_rows INTEGER NOT NULL,
  failed_rows INTEGER NOT NULL,
  import_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'completed',
  error_log JSONB
);

-- Adicionar campos para módulo de análise de combustível nas licenças
ALTER TABLE public.networks ADD COLUMN IF NOT EXISTS fuel_analysis_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.networks ADD COLUMN IF NOT EXISTS fuel_analysis_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.networks ADD COLUMN IF NOT EXISTS fuel_analysis_scope TEXT; -- 'municipio', 'cidade', 'estado', 'brasil'

-- RLS Policies para fuel_prices
ALTER TABLE public.fuel_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fuel prices"
ON public.fuel_prices
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers with fuel analysis can view fuel prices"
ON public.fuel_prices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM networks n
    INNER JOIN store_managers sm ON sm.network_id = n.id
    WHERE sm.user_id = auth.uid()
    AND n.fuel_analysis_enabled = true
  )
);

-- RLS Policies para fuel_price_imports
ALTER TABLE public.fuel_price_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fuel price imports"
ON public.fuel_price_imports
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_fuel_prices_updated_at
BEFORE UPDATE ON public.fuel_prices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();