ALTER TABLE public.store_managers
ADD COLUMN IF NOT EXISTS user_reference_code text;

CREATE SEQUENCE IF NOT EXISTS public.store_user_reference_code_seq;

CREATE OR REPLACE FUNCTION public.assign_store_user_reference_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id IS NOT NULL THEN
    NEW.user_reference_code := NULL;
    RETURN NEW;
  END IF;

  IF NEW.user_reference_code IS NULL OR NEW.user_reference_code = '' THEN
    NEW.user_reference_code := 'U' || LPAD(nextval('public.store_user_reference_code_seq')::text, 5, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_store_user_reference_code_on_store_managers ON public.store_managers;
CREATE TRIGGER assign_store_user_reference_code_on_store_managers
BEFORE INSERT OR UPDATE ON public.store_managers
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_user_reference_code();

WITH principal_rows AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS seq
  FROM public.store_managers
  WHERE store_id IS NULL
)
UPDATE public.store_managers sm
SET user_reference_code = 'U' || LPAD(principal_rows.seq::text, 5, '0')
FROM principal_rows
WHERE sm.id = principal_rows.id
  AND (sm.user_reference_code IS NULL OR sm.user_reference_code = '');

SELECT setval(
  'public.store_user_reference_code_seq',
  GREATEST(
    COALESCE((SELECT MAX(right(user_reference_code, 5)::bigint)
      FROM public.store_managers
      WHERE store_id IS NULL
        AND user_reference_code ~ '^U[0-9]{5}$'), 0),
    1
  ),
  true
);

CREATE UNIQUE INDEX IF NOT EXISTS store_managers_user_reference_code_unique_idx
ON public.store_managers (user_reference_code)
WHERE store_id IS NULL AND user_reference_code IS NOT NULL;