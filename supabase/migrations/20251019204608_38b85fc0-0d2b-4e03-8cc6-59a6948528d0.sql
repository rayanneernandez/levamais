-- Corrigir a função normalize_product_name para ter search_path seguro
CREATE OR REPLACE FUNCTION normalize_product_name(product_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove espaços extras, converte para maiúsculas, remove caracteres especiais
  RETURN UPPER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(product_name),
        '\s+', ' ', 'g'  -- substitui múltiplos espaços por um
      ),
      '[^A-Z0-9\s]', '', 'gi'  -- remove caracteres especiais
    )
  );
END;
$$;