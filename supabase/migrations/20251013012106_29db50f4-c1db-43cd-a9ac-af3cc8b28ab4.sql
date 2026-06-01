-- Criar tabela de logs de licenças
CREATE TABLE public.license_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  action text NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.license_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can view all license logs"
ON public.license_audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert license logs"
ON public.license_audit_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Função para registrar alterações de licenças
CREATE OR REPLACE FUNCTION public.log_license_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Pegar o usuário atual
  current_user_id := auth.uid();
  
  -- Registrar mudança em total_licenses
  IF OLD.total_licenses IS DISTINCT FROM NEW.total_licenses THEN
    INSERT INTO public.license_audit_logs (network_id, changed_by, action, field_name, old_value, new_value)
    VALUES (NEW.id, current_user_id, 'update', 'total_licenses', OLD.total_licenses::text, NEW.total_licenses::text);
  END IF;
  
  -- Registrar mudança em monthly_fee
  IF OLD.monthly_fee IS DISTINCT FROM NEW.monthly_fee THEN
    INSERT INTO public.license_audit_logs (network_id, changed_by, action, field_name, old_value, new_value)
    VALUES (NEW.id, current_user_id, 'update', 'monthly_fee', OLD.monthly_fee::text, NEW.monthly_fee::text);
  END IF;
  
  -- Registrar mudança em billing_day
  IF OLD.billing_day IS DISTINCT FROM NEW.billing_day THEN
    INSERT INTO public.license_audit_logs (network_id, changed_by, action, field_name, old_value, new_value)
    VALUES (NEW.id, current_user_id, 'update', 'billing_day', OLD.billing_day::text, NEW.billing_day::text);
  END IF;
  
  -- Registrar mudança em max_stores
  IF OLD.max_stores IS DISTINCT FROM NEW.max_stores THEN
    INSERT INTO public.license_audit_logs (network_id, changed_by, action, field_name, old_value, new_value)
    VALUES (NEW.id, current_user_id, 'update', 'max_stores', OLD.max_stores::text, NEW.max_stores::text);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para registrar mudanças
CREATE TRIGGER license_changes_audit
AFTER UPDATE ON public.networks
FOR EACH ROW
EXECUTE FUNCTION public.log_license_change();