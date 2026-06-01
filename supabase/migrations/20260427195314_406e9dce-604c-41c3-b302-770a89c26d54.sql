CREATE OR REPLACE FUNCTION public.generate_attendant_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  network_name TEXT;
  next_seq INTEGER;
  clean_network_name TEXT;
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

  -- Gerar somente no vínculo principal da rede.
  IF NEW.attendant_code IS NULL OR NEW.attendant_code = '' THEN
    SELECT name INTO network_name
    FROM networks
    WHERE id = NEW.network_id;

    clean_network_name := UPPER(REGEXP_REPLACE(COALESCE(network_name, 'REDE'), '[^a-zA-Z0-9]', '', 'g'));

    SELECT COALESCE(MAX(CAST(SPLIT_PART(attendant_code, '_', 1) AS integer)), 0) + 1
    INTO next_seq
    FROM store_managers
    WHERE network_id = NEW.network_id
      AND store_id IS NULL
      AND is_attendant = true
      AND attendant_code IS NOT NULL;

    NEW.attendant_code := next_seq::TEXT || '_' || clean_network_name;
  END IF;

  RETURN NEW;
END;
$function$;