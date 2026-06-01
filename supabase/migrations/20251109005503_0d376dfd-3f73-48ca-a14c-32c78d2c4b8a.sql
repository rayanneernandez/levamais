-- Tabela para armazenar VAPID keys do sistema
CREATE TABLE IF NOT EXISTS public.vapid_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key text NOT NULL,
  private_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS policies - apenas admins podem acessar
ALTER TABLE public.vapid_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view VAPID keys"
  ON public.vapid_keys
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admin can insert VAPID keys"
  ON public.vapid_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Índice para garantir apenas um registro
CREATE UNIQUE INDEX IF NOT EXISTS idx_vapid_keys_singleton ON public.vapid_keys ((true));