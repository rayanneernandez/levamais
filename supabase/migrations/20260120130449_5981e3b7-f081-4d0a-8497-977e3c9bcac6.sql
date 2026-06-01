-- Add is_manual_entry flag to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS is_manual_entry BOOLEAN DEFAULT FALSE;

-- Add index for filtering manual entries
CREATE INDEX IF NOT EXISTS idx_transactions_is_manual_entry ON public.transactions(is_manual_entry) WHERE is_manual_entry = true;

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.is_manual_entry IS 'Indicates if this transaction was created via manual entry (Leva+ Manual mode)';