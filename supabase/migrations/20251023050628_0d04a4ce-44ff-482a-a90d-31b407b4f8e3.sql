-- Adicionar campos de bônus de aniversário na tabela stores
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS birthday_bonus_points numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS birthday_bonus_cashback numeric DEFAULT 0;