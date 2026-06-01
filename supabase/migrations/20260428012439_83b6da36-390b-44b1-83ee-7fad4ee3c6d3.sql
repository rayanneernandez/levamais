-- Limpar attendant_code de registros vinculados a loja específica (devem ficar apenas no registro principal sem store_id)
UPDATE public.store_managers
SET attendant_code = NULL
WHERE store_id IS NOT NULL
  AND attendant_code IS NOT NULL;