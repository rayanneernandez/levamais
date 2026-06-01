-- Atualizar os 3 clientes para ter Rede JB como rede favorita
UPDATE clients 
SET favorite_network_id = network_id,
    favorite_network_changed_at = now()
WHERE cpf IN ('13678233740', '11020848758', '23358821714')
  AND network_id = '6638d36a-5bf9-47a8-bca9-280266057d90';