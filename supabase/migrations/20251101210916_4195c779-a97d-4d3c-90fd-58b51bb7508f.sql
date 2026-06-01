-- Adicionar campo para código do funcionário no PDV
ALTER TABLE store_managers 
ADD COLUMN codigo_funcionario_pdv text;

-- Criar índice para melhor performance nas buscas por código
CREATE INDEX idx_store_managers_codigo_funcionario_pdv 
ON store_managers(codigo_funcionario_pdv) 
WHERE codigo_funcionario_pdv IS NOT NULL;

COMMENT ON COLUMN store_managers.codigo_funcionario_pdv IS 'Código manual do funcionário usado para identificar vendas no PDV (ex: F001, FUNC123). Diferente do attendant_code que é gerado automaticamente para o portal colaborador.';