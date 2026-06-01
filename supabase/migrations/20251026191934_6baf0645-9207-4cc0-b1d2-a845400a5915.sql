-- Remover todas as políticas problemáticas
DROP POLICY IF EXISTS "Resellers can view own record" ON public.resellers;
DROP POLICY IF EXISTS "Resellers can update own record" ON public.resellers;
DROP POLICY IF EXISTS "Anyone can check if reseller exists" ON public.resellers;

-- Política simples: qualquer um pode ler (necessário para login)
-- Revendedores não contêm dados extremamente sensíveis, apenas nome e empresa
CREATE POLICY "Public can view resellers"
ON public.resellers
FOR SELECT
TO anon, authenticated
USING (true);