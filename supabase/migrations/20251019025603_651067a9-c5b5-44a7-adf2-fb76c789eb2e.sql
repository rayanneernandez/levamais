-- Ajustar saldo para não ficar negativo (política de cashback não permite negativo)
UPDATE clients 
SET total_points = GREATEST(0, total_points)
WHERE id = 'edc82292-8a95-46fa-9cb0-378298bde4d9';