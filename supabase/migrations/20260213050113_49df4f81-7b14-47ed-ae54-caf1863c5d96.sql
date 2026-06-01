
ALTER TABLE public.stores
ADD COLUMN block_accumulation_period_quantity integer DEFAULT null,
ADD COLUMN block_accumulation_points_period_quantity integer DEFAULT null;
