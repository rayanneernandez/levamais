-- Criar função para atualizar status da empresa quando orçamento for aprovado
CREATE OR REPLACE FUNCTION public.update_network_status_on_budget_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o orçamento foi aprovado e tem uma rede vinculada
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.network_id IS NOT NULL THEN
    -- Atualizar status da rede para active
    UPDATE public.networks
    SET status = 'active'
    WHERE id = NEW.network_id
    AND status = 'negotiation'; -- Só atualiza se ainda estiver em negociação
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função quando um orçamento for atualizado
DROP TRIGGER IF EXISTS trigger_update_network_on_budget_approval ON public.budgets;

CREATE TRIGGER trigger_update_network_on_budget_approval
AFTER UPDATE ON public.budgets
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.update_network_status_on_budget_approval();

COMMENT ON FUNCTION public.update_network_status_on_budget_approval() IS 'Atualiza o status da empresa de "negotiation" para "active" quando um orçamento é aprovado';
COMMENT ON TRIGGER trigger_update_network_on_budget_approval ON public.budgets IS 'Dispara automaticamente quando um orçamento muda para status aprovado';