-- Create pending network transfers table
CREATE TABLE pending_network_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  from_network_id UUID NOT NULL REFERENCES networks(id),
  to_network_id UUID NOT NULL REFERENCES networks(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT different_networks CHECK (from_network_id != to_network_id)
);

-- Create indexes
CREATE INDEX idx_pending_transfers_scheduled ON pending_network_transfers(scheduled_for, status);
CREATE INDEX idx_pending_transfers_client ON pending_network_transfers(client_id);
CREATE INDEX idx_pending_transfers_status ON pending_network_transfers(status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE pending_network_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clients can view own transfers"
ON pending_network_transfers
FOR SELECT
USING (client_id IN (
  SELECT id FROM clients WHERE user_id = auth.uid()
));

CREATE POLICY "Clients can create transfers"
ON pending_network_transfers
FOR INSERT
WITH CHECK (client_id IN (
  SELECT id FROM clients WHERE user_id = auth.uid()
));

CREATE POLICY "Clients can cancel own pending transfers"
ON pending_network_transfers
FOR UPDATE
USING (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  AND status = 'pending'
)
WITH CHECK (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  AND status = 'pending'
);

CREATE POLICY "Admins can view all transfers"
ON pending_network_transfers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all transfers"
ON pending_network_transfers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add comment
COMMENT ON TABLE pending_network_transfers IS 'Stores scheduled network transfers that will be processed on the 1st of each month';