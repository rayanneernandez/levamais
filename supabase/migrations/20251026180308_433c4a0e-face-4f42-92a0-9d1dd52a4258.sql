-- Adicionar políticas RLS para revendedores visualizarem suas comissões
CREATE POLICY "Resellers can view own commissions"
  ON public.reseller_commissions
  FOR SELECT
  USING (
    reseller_id IN (
      SELECT id FROM public.resellers 
      WHERE email IN (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- Permitir que revendedores vejam regras de comissão
CREATE POLICY "Resellers can view commission rules"
  ON public.reseller_commission_rules
  FOR SELECT
  USING (is_active = true);