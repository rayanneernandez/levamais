-- Adicionar campos para controlar visualização do programa de retenção
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS retention_card_first_shown_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS retention_decision_made_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS retention_decision_type text CHECK (retention_decision_type IN ('default', 'commitment', 'dismissed'));