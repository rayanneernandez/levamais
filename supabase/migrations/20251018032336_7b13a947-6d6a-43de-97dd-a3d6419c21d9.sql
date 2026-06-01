-- Remover políticas antigas que não estão funcionando
DROP POLICY IF EXISTS "Service role can insert transactions" ON public.webposto_transactions;
DROP POLICY IF EXISTS "Service role can update transactions" ON public.webposto_transactions;

-- Desabilitar RLS temporariamente para permitir que o service role opere sem restrições
-- O service role é confiável pois valida a API key antes de qualquer operação
ALTER TABLE public.webposto_transactions DISABLE ROW LEVEL SECURITY;

-- Ou, se preferir manter RLS ativo, criar políticas mais permissivas para authenticated users
-- (as edge functions rodam como authenticated com service_role_key)
ALTER TABLE public.webposto_transactions ENABLE ROW LEVEL SECURITY;

-- Política permissiva para INSERT (qualquer usuário autenticado pode inserir)
CREATE POLICY "Authenticated users can insert transactions"
ON public.webposto_transactions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política permissiva para UPDATE (qualquer usuário autenticado pode atualizar)
CREATE POLICY "Authenticated users can update transactions"
ON public.webposto_transactions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Manter as políticas de SELECT existentes
CREATE POLICY "Authenticated users can select transactions"
ON public.webposto_transactions
FOR SELECT
TO authenticated
USING (true);