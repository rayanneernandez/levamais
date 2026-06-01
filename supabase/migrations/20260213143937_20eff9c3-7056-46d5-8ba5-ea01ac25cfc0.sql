-- Add retention program columns to networks table
ALTER TABLE public.networks
  ADD COLUMN IF NOT EXISTS retention_is_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_cashback_multiplier_6_months numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS retention_cashback_multiplier_9_months numeric DEFAULT 15,
  ADD COLUMN IF NOT EXISTS retention_cashback_multiplier_12_months numeric DEFAULT 20,
  ADD COLUMN IF NOT EXISTS retention_points_multiplier_6_months numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS retention_points_multiplier_9_months numeric DEFAULT 15,
  ADD COLUMN IF NOT EXISTS retention_points_multiplier_12_months numeric DEFAULT 20;