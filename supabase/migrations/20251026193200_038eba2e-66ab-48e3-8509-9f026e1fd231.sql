-- Função para calcular e registrar comissões do revendedor
CREATE OR REPLACE FUNCTION public.calculate_reseller_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  active_rule RECORD;
  months_since_activation INTEGER;
  commission_pct NUMERIC;
  value_per_license NUMERIC;
  current_month DATE;
BEGIN
  -- Só processar se a network tiver reseller_id e status 'active'
  IF NEW.reseller_id IS NULL OR NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Se mudou para active agora (primeira ativação)
  IF OLD.status != 'active' AND NEW.status = 'active' THEN
    -- Buscar regra de comissão ativa que se aplica à data atual
    SELECT * INTO active_rule
    FROM public.reseller_commission_rules
    WHERE is_active = true
      AND CURRENT_DATE BETWEEN start_date AND end_date
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se não houver regra ativa, usar valores padrão
    IF active_rule IS NULL THEN
      active_rule.first_three_months_percentage := 50;
      active_rule.after_three_months_percentage := 15;
    END IF;

    -- Calcular valor por licença (mensalidade / total_licenses)
    IF NEW.total_licenses > 0 THEN
      value_per_license := NEW.monthly_fee / NEW.total_licenses;
    ELSE
      value_per_license := NEW.monthly_fee;
    END IF;

    -- Criar comissão para o primeiro mês (50%)
    current_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    
    INSERT INTO public.reseller_commissions (
      reseller_id,
      network_id,
      client_id,
      commission_month,
      monthly_fee,
      commission_percentage,
      commission_amount,
      status
    ) VALUES (
      NEW.reseller_id,
      NEW.id,
      NEW.id, -- client_id é o mesmo que network_id neste contexto
      current_month,
      NEW.monthly_fee,
      active_rule.first_three_months_percentage,
      (NEW.monthly_fee * active_rule.first_three_months_percentage / 100),
      'pending'
    )
    ON CONFLICT (reseller_id, network_id, commission_month) 
    DO UPDATE SET
      monthly_fee = EXCLUDED.monthly_fee,
      commission_percentage = EXCLUDED.commission_percentage,
      commission_amount = EXCLUDED.commission_amount,
      updated_at = now();
  END IF;

  -- Se a mensalidade ou licenças mudaram, atualizar comissões futuras
  IF (OLD.monthly_fee != NEW.monthly_fee OR OLD.total_licenses != NEW.total_licenses) THEN
    -- Atualizar comissões pendentes do mês atual e futuros
    UPDATE public.reseller_commissions
    SET 
      monthly_fee = NEW.monthly_fee,
      commission_amount = (NEW.monthly_fee * commission_percentage / 100),
      updated_at = now()
    WHERE network_id = NEW.id
      AND status = 'pending'
      AND commission_month >= DATE_TRUNC('month', CURRENT_DATE)::DATE;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger para calcular comissões automaticamente
DROP TRIGGER IF EXISTS trigger_calculate_reseller_commission ON public.networks;
CREATE TRIGGER trigger_calculate_reseller_commission
  AFTER INSERT OR UPDATE ON public.networks
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_reseller_commission();

-- Adicionar constraint único para evitar duplicatas
ALTER TABLE public.reseller_commissions
DROP CONSTRAINT IF EXISTS reseller_commissions_unique_month;

ALTER TABLE public.reseller_commissions
ADD CONSTRAINT reseller_commissions_unique_month 
UNIQUE (reseller_id, network_id, commission_month);