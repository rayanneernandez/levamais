-- Alterar coluna enable_redemption_limit_24h para max_redemptions_24h
ALTER TABLE stores 
DROP COLUMN enable_redemption_limit_24h;

ALTER TABLE stores 
ADD COLUMN max_redemptions_24h integer NOT NULL DEFAULT 1 CHECK (max_redemptions_24h >= 0);

COMMENT ON COLUMN stores.max_redemptions_24h IS 'Número máximo de resgates permitidos em 24 horas por cliente';