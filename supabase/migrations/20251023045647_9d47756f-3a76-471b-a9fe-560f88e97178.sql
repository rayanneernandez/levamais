-- Adicionar campos de SMS marketing na tabela networks
ALTER TABLE networks 
ADD COLUMN IF NOT EXISTS sms_marketing_limit integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_marketing_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_marketing_price numeric DEFAULT 0;