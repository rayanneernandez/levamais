ALTER TABLE public.networks
  ADD COLUMN IF NOT EXISTS signup_bonus_validity_amount integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS signup_bonus_validity_unit text DEFAULT 'days',
  ADD COLUMN IF NOT EXISTS birthday_bonus_validity_amount integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS birthday_bonus_validity_unit text DEFAULT 'days';