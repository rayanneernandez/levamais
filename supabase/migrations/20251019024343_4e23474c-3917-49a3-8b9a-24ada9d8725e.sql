-- Recalcular o saldo correto da Manuela baseado nas transações
UPDATE clients 
SET total_points = (
  SELECT COALESCE(SUM(points), 0)
  FROM transactions 
  WHERE client_id = 'edc82292-8a95-46fa-9cb0-378298bde4d9'
)
WHERE id = 'edc82292-8a95-46fa-9cb0-378298bde4d9';