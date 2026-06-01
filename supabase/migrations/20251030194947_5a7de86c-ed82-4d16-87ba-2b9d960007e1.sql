-- Adicionar campos para configuração de desligamento automático do resgate
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS auto_redemption_disable_mode TEXT CHECK (auto_redemption_disable_mode IN ('immediate', 'scheduled')) DEFAULT 'immediate',
ADD COLUMN IF NOT EXISTS auto_redemption_disable_days INTEGER CHECK (auto_redemption_disable_days BETWEEN 1 AND 30),
ADD COLUMN IF NOT EXISTS auto_redemption_disable_scheduled_at TIMESTAMPTZ;