-- Add loyalty_type to networks table
ALTER TABLE public.networks 
ADD COLUMN IF NOT EXISTS loyalty_type text 
CHECK (loyalty_type IN ('points', 'cashback')) 
DEFAULT 'cashback';