-- Tabela para armazenar transações pendentes (pré-venda)
CREATE TABLE IF NOT EXISTS public.webposto_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_transacao text UNIQUE NOT NULL,
  network_id uuid NOT NULL REFERENCES public.networks(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  client_id uuid REFERENCES public.clients(id),
  codigo_empresa text NOT NULL,
  codigo_voucher text NOT NULL,
  codigo_venda text NOT NULL,
  tipo_codigo text NOT NULL CHECK (tipo_codigo IN ('D', 'R', 'P')),
  valor_cashback numeric,
  valor_desconto_unitario numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  produtos jsonb NOT NULL,
  pagamentos jsonb,
  data_venda timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_webposto_transactions_id_transacao ON public.webposto_transactions(id_transacao);
CREATE INDEX idx_webposto_transactions_network_id ON public.webposto_transactions(network_id);
CREATE INDEX idx_webposto_transactions_store_id ON public.webposto_transactions(store_id);
CREATE INDEX idx_webposto_transactions_client_id ON public.webposto_transactions(client_id);
CREATE INDEX idx_webposto_transactions_status ON public.webposto_transactions(status);

-- RLS policies
ALTER TABLE public.webposto_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Network managers can view own network transactions"
  ON public.webposto_transactions
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager') 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Admins can view all transactions"
  ON public.webposto_transactions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_webposto_transactions_updated_at
  BEFORE UPDATE ON public.webposto_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();