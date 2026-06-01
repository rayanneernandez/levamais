-- Adicionar política RLS para clientes visualizarem promoções ONE ativas
CREATE POLICY "Clients can view active one promotions from their favorite network"
  ON public.one_promotions
  FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND end_date >= CURRENT_DATE
    AND network_id IN (
      SELECT favorite_network_id 
      FROM clients 
      WHERE user_id = auth.uid() 
      AND favorite_network_id IS NOT NULL
    )
  );

-- Adicionar política para clientes visualizarem stores de promoções
CREATE POLICY "Clients can view one promotion stores"
  ON public.one_promotion_stores
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id 
      FROM one_promotions 
      WHERE is_active = true 
      AND end_date >= CURRENT_DATE
      AND network_id IN (
        SELECT favorite_network_id 
        FROM clients 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Adicionar política para clientes visualizarem produtos de promoções
CREATE POLICY "Clients can view one promotion products"
  ON public.one_promotion_products
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id 
      FROM one_promotions 
      WHERE is_active = true 
      AND end_date >= CURRENT_DATE
      AND network_id IN (
        SELECT favorite_network_id 
        FROM clients 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Política para clientes criarem resgates
CREATE POLICY "Clients can create own redemptions"
  ON public.one_promotion_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id 
      FROM clients 
      WHERE user_id = auth.uid()
    )
  );