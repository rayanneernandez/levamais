-- Create table for Leva+ ONE card numbers
CREATE TABLE public.one_card_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.one_card_numbers ENABLE ROW LEVEL SECURITY;

-- Policies for admins
CREATE POLICY "Admins can manage all card numbers"
ON public.one_card_numbers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies for network managers
CREATE POLICY "Network managers can view own network card numbers"
ON public.one_card_numbers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'network_manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = one_card_numbers.client_id
    AND c.favorite_network_id = get_user_network_id(auth.uid())
  )
);

-- Policies for clients
CREATE POLICY "Clients can view own card number"
ON public.one_card_numbers
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_one_card_numbers_client_id ON public.one_card_numbers(client_id);
CREATE INDEX idx_one_card_numbers_card_number ON public.one_card_numbers(card_number);

-- Trigger for updated_at
CREATE TRIGGER update_one_card_numbers_updated_at
BEFORE UPDATE ON public.one_card_numbers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();