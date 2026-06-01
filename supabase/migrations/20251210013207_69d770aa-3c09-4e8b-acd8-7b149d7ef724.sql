-- Add WhatsApp support fields to networks table
ALTER TABLE public.networks 
ADD COLUMN IF NOT EXISTS support_whatsapp text,
ADD COLUMN IF NOT EXISTS support_whatsapp_message text;

-- Add comment for documentation
COMMENT ON COLUMN public.networks.support_whatsapp IS 'WhatsApp number for customer support (format: 5521999999999)';
COMMENT ON COLUMN public.networks.support_whatsapp_message IS 'Custom welcome message for WhatsApp support';