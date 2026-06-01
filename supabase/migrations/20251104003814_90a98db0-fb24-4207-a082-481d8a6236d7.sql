-- Create transaction_ratings table for NPS
CREATE TABLE IF NOT EXISTS public.transaction_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(transaction_id)
);

-- Enable RLS
ALTER TABLE public.transaction_ratings ENABLE ROW LEVEL SECURITY;

-- Clients can view and create their own ratings
CREATE POLICY "Clients can view own ratings"
  ON public.transaction_ratings
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create own ratings"
  ON public.transaction_ratings
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update own ratings"
  ON public.transaction_ratings
  FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- Network managers can view ratings from their network
CREATE POLICY "Network managers can view network ratings"
  ON public.transaction_ratings
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) AND
    network_id = get_user_network_id(auth.uid())
  );

-- Admins can view all ratings
CREATE POLICY "Admins can view all ratings"
  ON public.transaction_ratings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_transaction_ratings_updated_at
  BEFORE UPDATE ON public.transaction_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_transaction_ratings_network_id ON public.transaction_ratings(network_id);
CREATE INDEX idx_transaction_ratings_store_id ON public.transaction_ratings(store_id);
CREATE INDEX idx_transaction_ratings_client_id ON public.transaction_ratings(client_id);
CREATE INDEX idx_transaction_ratings_rating ON public.transaction_ratings(rating);
CREATE INDEX idx_transaction_ratings_created_at ON public.transaction_ratings(created_at DESC);