-- CORREÇÃO CRÍTICA: Remover políticas permissivas de webposto_transactions
DROP POLICY IF EXISTS "Authenticated users can select transactions" ON public.webposto_transactions;
DROP POLICY IF EXISTS "Authenticated users can update transactions" ON public.webposto_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.webposto_transactions;

-- Manter apenas as políticas seguras:
-- 1. Admins podem ver tudo (já existe)
-- 2. Network managers podem ver apenas da própria rede (já existe)

-- As políticas existentes que serão mantidas:
-- ✅ "Admins can view all transactions" 
-- ✅ "Network managers can view own network transactions"