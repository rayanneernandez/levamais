-- Corrige a view para usar SECURITY INVOKER (permissões do usuário que consulta)
CREATE OR REPLACE VIEW fuel_prices_analysis 
WITH (security_invoker = true)
AS
SELECT *
FROM fuel_prices
WHERE produto != 'GLP';

-- Adiciona comentário explicativo
COMMENT ON VIEW fuel_prices_analysis IS 'View de preços de combustível para análises, excluindo GLP que não conta para receita de posto';