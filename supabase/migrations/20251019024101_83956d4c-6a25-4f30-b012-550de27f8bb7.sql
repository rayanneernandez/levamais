-- Criar corretamente a transação da venda de R$ 450 da Manuela
INSERT INTO transactions (
  client_id,
  store_id,
  type,
  amount,
  points,
  description,
  created_at
) VALUES (
  'edc82292-8a95-46fa-9cb0-378298bde4d9',  -- Manuela
  'd3a66313-5197-47dd-ae56-0453ed8fd4cd',  -- LOJA CORDEIRO
  'accumulation',
  450.00,
  4.50,  -- 1% de cashback = R$ 4,50
  'webPosto - Venda 4080 - ID: 7ad1257e7ee3450d (Recuperado)',
  '2025-10-18T23:31:55'
);

-- Atualizar o saldo da Manuela
UPDATE clients 
SET total_points = total_points + 4.50
WHERE id = 'edc82292-8a95-46fa-9cb0-378298bde4d9';