-- Atualizar todas as lojas da rede para usar cashback 1%
UPDATE stores 
SET 
  loyalty_type = 'cashback',
  cashback_type = 'percentage',
  cashback_percentage = 1.00,
  points_per_real = 1.00,
  real_per_point = 0.01,
  updated_at = now()
WHERE network_id IN (SELECT id FROM networks LIMIT 1);