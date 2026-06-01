-- =============================================
-- LEVA+ MANUAL - FASE 1: ESTRUTURA DO BANCO
-- =============================================

-- 1. Adicionar flag de modo manual na tabela stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_manual_mode boolean DEFAULT false;

-- 2. Criar tabela de produtos da loja
CREATE TABLE IF NOT EXISTS store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid REFERENCES networks(id) ON DELETE CASCADE NOT NULL,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  name text NOT NULL,
  internal_code text NOT NULL,
  barcode text,
  cost numeric(10,2) DEFAULT 0,
  price numeric(10,2) NOT NULL,
  stock integer DEFAULT 0,
  min_stock integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices únicos para produtos
CREATE UNIQUE INDEX IF NOT EXISTS store_products_network_internal_code_idx 
  ON store_products(network_id, internal_code);
CREATE UNIQUE INDEX IF NOT EXISTS store_products_network_barcode_idx 
  ON store_products(network_id, barcode) WHERE barcode IS NOT NULL AND barcode != '';

-- Índice para busca por nome
CREATE INDEX IF NOT EXISTS store_products_name_idx ON store_products(name);
CREATE INDEX IF NOT EXISTS store_products_network_id_idx ON store_products(network_id);

-- 3. Criar tabela de movimentação de estoque
CREATE TABLE IF NOT EXISTS store_product_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES store_products(id) ON DELETE CASCADE NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste', 'venda')),
  quantity integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  observation text,
  user_id uuid,
  user_name text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_product_id_idx ON store_product_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx ON store_product_stock_movements(created_at);

-- 4. Criar tabela de histórico de custo
CREATE TABLE IF NOT EXISTS store_product_cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES store_products(id) ON DELETE CASCADE NOT NULL,
  previous_cost numeric(10,2),
  new_cost numeric(10,2) NOT NULL,
  quantity_purchased integer DEFAULT 0,
  average_cost numeric(10,2),
  user_id uuid,
  user_name text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cost_history_product_id_idx ON store_product_cost_history(product_id);
CREATE INDEX IF NOT EXISTS cost_history_created_at_idx ON store_product_cost_history(created_at);

-- 5. Função para gerar código interno automático de produtos
CREATE OR REPLACE FUNCTION generate_store_product_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.internal_code IS NULL OR NEW.internal_code = '' THEN
    SELECT COALESCE(MAX(
      CAST(NULLIF(SUBSTRING(internal_code FROM 5), '') AS integer)
    ), 0) + 1
    INTO next_num
    FROM store_products
    WHERE network_id = NEW.network_id
      AND internal_code ~ '^PRD-[0-9]+$';
    
    NEW.internal_code := 'PRD-' || LPAD(next_num::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para código automático
DROP TRIGGER IF EXISTS set_store_product_code ON store_products;
CREATE TRIGGER set_store_product_code
BEFORE INSERT ON store_products
FOR EACH ROW
EXECUTE FUNCTION generate_store_product_code();

-- 6. Trigger para updated_at em store_products
DROP TRIGGER IF EXISTS update_store_products_updated_at ON store_products;
CREATE TRIGGER update_store_products_updated_at
BEFORE UPDATE ON store_products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Habilitar RLS nas tabelas
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_product_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_product_cost_history ENABLE ROW LEVEL SECURITY;

-- Policies para store_products
CREATE POLICY "Network managers can view their products"
ON store_products FOR SELECT
TO authenticated
USING (
  network_id IN (
    SELECT network_id FROM store_managers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Network managers can insert products"
ON store_products FOR INSERT
TO authenticated
WITH CHECK (
  network_id IN (
    SELECT network_id FROM store_managers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Network managers can update their products"
ON store_products FOR UPDATE
TO authenticated
USING (
  network_id IN (
    SELECT network_id FROM store_managers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Network managers can delete their products"
ON store_products FOR DELETE
TO authenticated
USING (
  network_id IN (
    SELECT network_id FROM store_managers WHERE user_id = auth.uid()
  )
);

-- Policies para store_product_stock_movements
CREATE POLICY "Network managers can view stock movements"
ON store_product_stock_movements FOR SELECT
TO authenticated
USING (
  product_id IN (
    SELECT sp.id FROM store_products sp
    INNER JOIN store_managers sm ON sp.network_id = sm.network_id
    WHERE sm.user_id = auth.uid()
  )
);

CREATE POLICY "Network managers can insert stock movements"
ON store_product_stock_movements FOR INSERT
TO authenticated
WITH CHECK (
  product_id IN (
    SELECT sp.id FROM store_products sp
    INNER JOIN store_managers sm ON sp.network_id = sm.network_id
    WHERE sm.user_id = auth.uid()
  )
);

-- Policies para store_product_cost_history
CREATE POLICY "Network managers can view cost history"
ON store_product_cost_history FOR SELECT
TO authenticated
USING (
  product_id IN (
    SELECT sp.id FROM store_products sp
    INNER JOIN store_managers sm ON sp.network_id = sm.network_id
    WHERE sm.user_id = auth.uid()
  )
);

CREATE POLICY "Network managers can insert cost history"
ON store_product_cost_history FOR INSERT
TO authenticated
WITH CHECK (
  product_id IN (
    SELECT sp.id FROM store_products sp
    INNER JOIN store_managers sm ON sp.network_id = sm.network_id
    WHERE sm.user_id = auth.uid()
  )
);