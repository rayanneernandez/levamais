
ALTER TABLE public.stores
ADD COLUMN block_accumulation_duration_amount integer DEFAULT null,
ADD COLUMN block_accumulation_duration_unit text DEFAULT 'days',
ADD COLUMN block_accumulation_points_duration_amount integer DEFAULT null,
ADD COLUMN block_accumulation_points_duration_unit text DEFAULT 'days';
