-- Remover política que permite acesso público aos dados das lojas
DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;

-- A política "Clients can view active stores" já existe e exige autenticação (has_role check)
-- Isso significa que apenas clientes logados poderão ver as lojas ativas