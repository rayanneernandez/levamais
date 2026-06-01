-- Trocar índice único global por único por rede
DROP INDEX IF EXISTS public.store_managers_user_reference_code_unique_idx;

-- Renumerar primeiro (limpar para evitar conflito durante o update)
UPDATE public.store_managers 
SET user_reference_code = NULL 
WHERE store_id IS NULL AND user_reference_code IS NOT NULL;

WITH renumbered AS (
  SELECT 
    id,
    'U' || LPAD(
      ROW_NUMBER() OVER (PARTITION BY network_id ORDER BY created_at)::text, 
      5, '0'
    ) AS new_code
  FROM public.store_managers
  WHERE store_id IS NULL
)
UPDATE public.store_managers sm
SET user_reference_code = r.new_code
FROM renumbered r
WHERE sm.id = r.id;

-- Criar índice único por (network_id, user_reference_code)
CREATE UNIQUE INDEX store_managers_user_reference_code_per_network_idx
ON public.store_managers (network_id, user_reference_code)
WHERE store_id IS NULL AND user_reference_code IS NOT NULL;

-- Atualizar trigger para gerar por rede
CREATE OR REPLACE FUNCTION public.assign_store_user_reference_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF NEW.store_id IS NOT NULL THEN
    NEW.user_reference_code := NULL;
    RETURN NEW;
  END IF;

  IF NEW.user_reference_code IS NULL OR NEW.user_reference_code = '' THEN
    SELECT COALESCE(MAX(
      CAST(NULLIF(SUBSTRING(user_reference_code FROM 2), '') AS integer)
    ), 0) + 1
    INTO next_num
    FROM public.store_managers
    WHERE network_id = NEW.network_id
      AND store_id IS NULL
      AND user_reference_code ~ '^U[0-9]+$';

    NEW.user_reference_code := 'U' || LPAD(next_num::text, 5, '0');
  END IF;

  RETURN NEW;
END;
$function$;