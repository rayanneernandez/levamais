-- Adicionar campo para armazenar os últimos 4 dígitos do cartão ONE
ALTER TABLE public.client_subscriptions_one 
ADD COLUMN card_last_digits TEXT;