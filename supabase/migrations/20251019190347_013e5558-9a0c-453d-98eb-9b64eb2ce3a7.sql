-- Adicionar campos ao profiles para comercial
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_commercial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_budget_approver boolean DEFAULT false;

-- Tabela de categorias de produtos/serviços
CREATE TABLE public.product_service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Tabela de produtos e serviços
CREATE TABLE public.products_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('product', 'service')),
  category_id uuid REFERENCES public.product_service_categories(id),
  unit_of_measure text NOT NULL,
  cost_value numeric,
  sale_value numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Tabela de orçamentos (ajustado para usar networks)
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_number text NOT NULL UNIQUE,
  network_id uuid NOT NULL REFERENCES public.networks(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  seller_id uuid NOT NULL REFERENCES public.profiles(id),
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'pending_internal_approval', 'approved', 'declined')),
  total_value numeric NOT NULL DEFAULT 0,
  products_total numeric DEFAULT 0,
  services_total numeric DEFAULT 0,
  freight_value numeric DEFAULT 0,
  temperature text CHECK (temperature IN ('cold', 'warm', 'hot')),
  products_payment_method text,
  products_installments integer DEFAULT 1,
  products_first_payment_date date,
  services_payment_method text,
  services_installments integer DEFAULT 1,
  services_first_payment_date date,
  financial_contact_name text,
  financial_contact_email text,
  financial_contact_phone text,
  expires_at timestamptz NOT NULL,
  expected_closing_date date,
  approval_token text,
  approved_at timestamptz,
  approved_by_name text,
  approved_by_cpf text,
  approved_by_email text,
  approved_by_position text,
  approval_signature text,
  approval_document_hash text,
  approval_ip text,
  approval_user_agent text,
  approval_latitude numeric,
  approval_longitude numeric,
  approval_audit_pdf_url text,
  internal_approved_by uuid REFERENCES auth.users(id),
  internal_approved_at timestamptz,
  internal_approved_by_name text,
  internal_approved_by_email text,
  internal_approved_by_cpf text,
  internal_approval_ip text,
  internal_approval_user_agent text,
  internal_approval_latitude numeric,
  internal_approval_longitude numeric,
  internal_approval_document_hash text,
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de itens do orçamento
CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  product_service_id uuid NOT NULL REFERENCES public.products_services(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_value numeric NOT NULL,
  total_value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de códigos de verificação (aprovação cliente)
CREATE TABLE public.budget_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  email text NOT NULL,
  phone text,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de códigos de verificação (aprovação interna)
CREATE TABLE public.budget_internal_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sequences para códigos automáticos
CREATE SEQUENCE IF NOT EXISTS product_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS service_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS budget_number_seq START 1;

-- Função para gerar código de produto/serviço
CREATE OR REPLACE FUNCTION public.generate_product_service_code(item_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  IF item_type = 'product' THEN
    SELECT nextval('product_code_seq') INTO next_num;
    prefix := '#P';
  ELSE
    SELECT nextval('service_code_seq') INTO next_num;
    prefix := '#S';
  END IF;
  RETURN prefix || LPAD(next_num::TEXT, 3, '0');
END;
$$;

-- Trigger para código automático de produto/serviço
CREATE OR REPLACE FUNCTION public.set_product_service_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_product_service_code(NEW.type);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_product_service_code_trigger
BEFORE INSERT ON public.products_services
FOR EACH ROW
EXECUTE FUNCTION public.set_product_service_code();

-- Função para gerar número do orçamento
CREATE OR REPLACE FUNCTION public.generate_budget_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT nextval('budget_number_seq') INTO next_num;
  RETURN '#O-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- Trigger para número automático do orçamento
CREATE OR REPLACE FUNCTION public.set_budget_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.budget_number IS NULL OR NEW.budget_number = '' THEN
    NEW.budget_number := generate_budget_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_budget_number_trigger
BEFORE INSERT ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.set_budget_number();

-- Função para gerar token de aprovação
CREATE OR REPLACE FUNCTION public.generate_approval_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN gen_random_uuid()::text;
END;
$$;

-- Trigger para token de aprovação
CREATE OR REPLACE FUNCTION public.set_approval_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_token IS NULL THEN
    NEW.approval_token := generate_approval_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_approval_token_trigger
BEFORE INSERT ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.set_approval_token();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_products_services_updated_at
BEFORE UPDATE ON public.products_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.product_service_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para verificar se usuário é aprovador de orçamentos
CREATE OR REPLACE FUNCTION public.is_budget_approver(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_budget_approver FROM profiles WHERE id = _user_id),
    false
  );
$$;

-- Enable RLS
ALTER TABLE public.product_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_internal_verification_codes ENABLE ROW LEVEL SECURITY;

-- Policies para categorias
CREATE POLICY "Admins can manage all categories"
ON public.product_service_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active categories"
ON public.product_service_categories
FOR SELECT
USING (is_active = true);

-- Policies para produtos/serviços
CREATE POLICY "Admins can manage all products/services"
ON public.products_services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active products/services"
ON public.products_services
FOR SELECT
USING (is_active = true);

CREATE POLICY "Public can view products for budget approval"
ON public.products_services
FOR SELECT
USING (
  id IN (
    SELECT bi.product_service_id
    FROM budget_items bi
    JOIN budgets b ON b.id = bi.budget_id
    WHERE b.approval_token IS NOT NULL
  )
);

-- Policies para orçamentos
CREATE POLICY "Admins can manage all budgets"
ON public.budgets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Commercial users can create budgets"
ON public.budgets
FOR INSERT
WITH CHECK (
  (SELECT is_commercial FROM profiles WHERE id = auth.uid()) = true
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Commercial users can view their budgets"
ON public.budgets
FOR SELECT
USING (
  seller_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Commercial users can update their budgets"
ON public.budgets
FOR UPDATE
USING (
  seller_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Budget approval view via token"
ON public.budgets
FOR SELECT
USING (approval_token IS NOT NULL);

CREATE POLICY "Budget approval update via token"
ON public.budgets
FOR UPDATE
USING (approval_token IS NOT NULL)
WITH CHECK (approval_token IS NOT NULL);

CREATE POLICY "Budget approvers can view pending internal approval"
ON public.budgets
FOR SELECT
USING (
  status = 'pending_internal_approval'
  AND is_budget_approver(auth.uid())
);

CREATE POLICY "Budget approvers can update pending internal approval"
ON public.budgets
FOR UPDATE
USING (
  status = 'pending_internal_approval'
  AND is_budget_approver(auth.uid())
);

-- Policies para itens do orçamento
CREATE POLICY "Admins can manage all budget items"
ON public.budget_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view items of their budgets"
ON public.budget_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_items.budget_id
    AND (
      b.seller_id = auth.uid()
      OR b.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Users can create items for their budgets"
ON public.budget_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_items.budget_id
    AND (
      b.seller_id = auth.uid()
      OR b.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Users can delete items from their budgets"
ON public.budget_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_items.budget_id
    AND (
      b.seller_id = auth.uid()
      OR b.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Public can view items for budget approval"
ON public.budget_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_items.budget_id
    AND b.approval_token IS NOT NULL
  )
);

-- Policies para códigos de verificação (cliente)
CREATE POLICY "Admins can manage verification codes"
ON public.budget_verification_codes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone with approval token can create codes"
ON public.budget_verification_codes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_verification_codes.budget_id
    AND b.approval_token IS NOT NULL
  )
);

CREATE POLICY "Anyone with approval token can verify codes"
ON public.budget_verification_codes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_verification_codes.budget_id
    AND b.approval_token IS NOT NULL
  )
);

CREATE POLICY "System can mark codes as used"
ON public.budget_verification_codes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = budget_verification_codes.budget_id
    AND b.approval_token IS NOT NULL
  )
);

-- Policies para códigos de verificação (interno)
CREATE POLICY "Approvers can manage internal verification codes"
ON public.budget_internal_verification_codes
FOR ALL
USING (is_budget_approver(auth.uid()))
WITH CHECK (is_budget_approver(auth.uid()));