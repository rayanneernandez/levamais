-- Corrigir função generate_api_key para usar gen_random_uuid() e encode
DROP FUNCTION IF EXISTS public.generate_api_key(uuid, text);

CREATE OR REPLACE FUNCTION public.generate_api_key(network_uuid uuid, key_type_param text DEFAULT 'live'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_key TEXT;
  prefix TEXT;
BEGIN
  -- Definir prefixo baseado no tipo
  prefix := CASE 
    WHEN key_type_param = 'test' THEN 'leva_test_sk_'
    ELSE 'leva_live_sk_'
  END;
  
  -- Gerar chave única usando gen_random_uuid() e encode
  new_key := prefix || encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'hex') || encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'hex');
  
  RETURN new_key;
END;
$$;