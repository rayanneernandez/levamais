-- Add redemption fields to store_products
ALTER TABLE public.store_products
ADD COLUMN IF NOT EXISTS is_redemption_product boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cashback_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_value integer DEFAULT 0;

-- Add index for faster queries on redemption products
CREATE INDEX IF NOT EXISTS idx_store_products_redemption 
ON public.store_products(network_id, is_redemption_product) 
WHERE is_redemption_product = true;

-- Add comments for documentation
COMMENT ON COLUMN public.store_products.is_redemption_product IS 'Flag indicating if product is available for redemption';
COMMENT ON COLUMN public.store_products.cashback_value IS 'Cashback value required to redeem this product';
COMMENT ON COLUMN public.store_products.points_value IS 'Points required to redeem this product';