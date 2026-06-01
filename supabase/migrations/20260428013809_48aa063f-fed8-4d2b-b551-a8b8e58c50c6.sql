-- 1. Atualizar trigger para usar o número do user_reference_code
CREATE OR REPLACE FUNCTION public.generate_attendant_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  network_name TEXT;
  clean_network_name TEXT;
  ref_number INTEGER;
BEGIN
  -- Registros vinculados a loja nunca devem carregar attendant_code.
  IF NEW.store_id IS NOT NULL THEN
    NEW.attendant_code := NULL;
    RETURN NEW;
  END IF;

  -- Se não for atendente, remover o código.
  IF COALESCE(NEW.is_attendant, false) = false THEN
    NEW.attendant_code := NULL;
    RETURN NEW;
  END IF;

  -- Gerar somente quando ainda não houver código.
  IF NEW.attendant_code IS NULL OR NEW.attendant_code = '' THEN
    SELECT name INTO network_name FROM networks WHERE id = NEW.network_id;
    clean_network_name := UPPER(REGEXP_REPLACE(COALESCE(network_name, 'REDE'), '[^a-zA-Z0-9]', '', 'g'));

    -- Extrair número do user_reference_code (formato U00005 -> 5)
    ref_number := NULLIF(SUBSTRING(COALESCE(NEW.user_reference_code, '') FROM 2), '')::integer;

    -- Fallback: se não houver user_reference_code, usar MAX+1 (legado)
    IF ref_number IS NULL THEN
      SELECT COALESCE(MAX(CAST(SPLIT_PART(attendant_code, '_', 1) AS integer)), 0) + 1
      INTO ref_number
      FROM store_managers
      WHERE network_id = NEW.network_id
        AND store_id IS NULL
        AND is_attendant = true
        AND attendant_code IS NOT NULL;
    END IF;

    NEW.attendant_code := ref_number::TEXT || '_' || clean_network_name;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Recalcular códigos existentes em duas etapas (evita colisão de UNIQUE)
-- Etapa A: prefixar todos com TMP_
UPDATE public.store_managers
SET attendant_code = 'TMP_' || attendant_code
WHERE store_id IS NULL
  AND is_attendant = true
  AND attendant_code IS NOT NULL
  AND user_reference_code ~ '^U[0-9]+$';

-- Etapa B: recalcular com base no user_reference_code
UPDATE public.store_managers sm
SET attendant_code = (
  SUBSTRING(sm.user_reference_code FROM 2)::integer::text
  || '_'
  || UPPER(REGEXP_REPLACE(n.name, '[^a-zA-Z0-9]', '', 'g'))
)
FROM public.networks n
WHERE sm.network_id = n.id
  AND sm.store_id IS NULL
  AND sm.is_attendant = true
  AND sm.attendant_code LIKE 'TMP_%'
  AND sm.user_reference_code ~ '^U[0-9]+$';