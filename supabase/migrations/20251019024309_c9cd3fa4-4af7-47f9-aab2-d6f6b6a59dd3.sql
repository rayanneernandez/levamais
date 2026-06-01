-- Deletar uma das transações duplicadas (mantendo apenas a primeira)
DELETE FROM transactions 
WHERE id = '3e5f2e8f-63a2-4549-8bce-e42612640b02';

-- Ajustar o saldo da Manuela (remover os R$ 4,50 duplicados)
UPDATE clients 
SET total_points = total_points - 4.50
WHERE id = 'edc82292-8a95-46fa-9cb0-378298bde4d9';