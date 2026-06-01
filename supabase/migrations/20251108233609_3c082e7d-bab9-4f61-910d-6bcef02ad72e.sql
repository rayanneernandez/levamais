-- Add metadata column to webposto_transactions table
ALTER TABLE webposto_transactions 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;