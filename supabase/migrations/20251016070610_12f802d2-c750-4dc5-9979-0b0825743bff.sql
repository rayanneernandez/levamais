-- Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text
);

-- Índices para melhorar performance nas buscas
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);

-- RLS policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own network audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) AND
    user_id IN (
      SELECT user_id 
      FROM public.store_managers 
      WHERE network_id = get_user_network_id(auth.uid())
    )
  );

-- Função genérica para criar logs de auditoria
CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_fields text[];
  old_jsonb jsonb;
  new_jsonb jsonb;
  current_user_email text;
BEGIN
  -- Obter email do usuário atual
  SELECT email INTO current_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Converter OLD e NEW para JSONB
  IF TG_OP = 'DELETE' THEN
    old_jsonb := to_jsonb(OLD);
    new_jsonb := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_jsonb := NULL;
    new_jsonb := to_jsonb(NEW);
  ELSE
    old_jsonb := to_jsonb(OLD);
    new_jsonb := to_jsonb(NEW);
    
    -- Identificar campos alterados
    SELECT array_agg(key)
    INTO changed_fields
    FROM jsonb_each(new_jsonb)
    WHERE new_jsonb->key IS DISTINCT FROM old_jsonb->key;
  END IF;

  -- Inserir log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_fields,
    user_id,
    user_email,
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    CASE 
      WHEN TG_OP = 'DELETE' THEN (old_jsonb->>'id')::uuid
      ELSE (new_jsonb->>'id')::uuid
    END,
    TG_OP,
    old_jsonb,
    new_jsonb,
    changed_fields,
    auth.uid(),
    current_user_email,
    now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Criar triggers para as principais tabelas
CREATE TRIGGER audit_clients_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_stores_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_transactions_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_networks_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.networks
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_store_managers_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.store_managers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_store_access_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.store_access_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_balance_adjustments_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.balance_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_loyalty_campaigns_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.loyalty_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();