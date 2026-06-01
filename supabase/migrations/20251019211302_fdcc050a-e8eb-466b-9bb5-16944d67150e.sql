-- Criar enum para tipos de anomalia
CREATE TYPE anomaly_type AS ENUM (
  'frequency_spike',
  'unusual_amount',
  'velocity_pattern',
  'time_pattern',
  'geographic_anomaly',
  'redemption_pattern',
  'multiple_stores',
  'suspicious_behavior'
);

-- Criar enum para severidade
CREATE TYPE anomaly_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Criar enum para status da anomalia
CREATE TYPE anomaly_status AS ENUM ('pending', 'investigating', 'resolved', 'false_positive', 'blocked');

-- Tabela principal de anomalias
CREATE TABLE public.anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  anomaly_type anomaly_type NOT NULL,
  severity anomaly_severity NOT NULL,
  status anomaly_status NOT NULL DEFAULT 'pending',
  fraud_score NUMERIC(5,2) NOT NULL CHECK (fraud_score >= 0 AND fraud_score <= 100),
  summary TEXT NOT NULL,
  details JSONB,
  suggested_actions TEXT[],
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações associadas às anomalias
CREATE TABLE public.anomaly_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id UUID NOT NULL REFERENCES public.anomalies(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(anomaly_id, transaction_id)
);

-- Tabela de regras acionadas
CREATE TABLE public.anomaly_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id UUID NOT NULL REFERENCES public.anomalies(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de histórico de ações
CREATE TABLE public.anomaly_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id UUID NOT NULL REFERENCES public.anomalies(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de clientes bloqueados
CREATE TABLE public.blocked_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  blocked_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  justification TEXT NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unblocked_at TIMESTAMP WITH TIME ZONE,
  unblocked_by UUID REFERENCES auth.users(id),
  unblock_justification TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, network_id, is_active)
);

-- Índices para performance
CREATE INDEX idx_anomalies_client ON public.anomalies(client_id);
CREATE INDEX idx_anomalies_network ON public.anomalies(network_id);
CREATE INDEX idx_anomalies_store ON public.anomalies(store_id);
CREATE INDEX idx_anomalies_status ON public.anomalies(status);
CREATE INDEX idx_anomalies_severity ON public.anomalies(severity);
CREATE INDEX idx_anomalies_detected_at ON public.anomalies(detected_at DESC);
CREATE INDEX idx_anomaly_transactions_anomaly ON public.anomaly_transactions(anomaly_id);
CREATE INDEX idx_anomaly_rules_anomaly ON public.anomaly_rules(anomaly_id);
CREATE INDEX idx_anomaly_history_anomaly ON public.anomaly_history(anomaly_id);
CREATE INDEX idx_blocked_clients_client ON public.blocked_clients(client_id);
CREATE INDEX idx_blocked_clients_active ON public.blocked_clients(is_active) WHERE is_active = true;

-- Trigger para updated_at
CREATE TRIGGER update_anomalies_updated_at
  BEFORE UPDATE ON public.anomalies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blocked_clients_updated_at
  BEFORE UPDATE ON public.blocked_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_clients ENABLE ROW LEVEL SECURITY;

-- Admins podem ver e gerenciar todas as anomalias
CREATE POLICY "Admins can manage all anomalies"
  ON public.anomalies
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Network managers podem ver anomalias de sua rede
CREATE POLICY "Network managers can view own network anomalies"
  ON public.anomalies
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

-- Network managers podem atualizar anomalias de sua rede
CREATE POLICY "Network managers can update own network anomalies"
  ON public.anomalies
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

-- Políticas para anomaly_transactions
CREATE POLICY "Admins can manage anomaly transactions"
  ON public.anomaly_transactions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own anomaly transactions"
  ON public.anomaly_transactions
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.anomalies a
      WHERE a.id = anomaly_transactions.anomaly_id
      AND a.network_id = get_user_network_id(auth.uid())
    )
  );

-- Políticas para anomaly_rules
CREATE POLICY "Admins can manage anomaly rules"
  ON public.anomaly_rules
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own anomaly rules"
  ON public.anomaly_rules
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.anomalies a
      WHERE a.id = anomaly_rules.anomaly_id
      AND a.network_id = get_user_network_id(auth.uid())
    )
  );

-- Políticas para anomaly_history
CREATE POLICY "Admins can manage anomaly history"
  ON public.anomaly_history
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own anomaly history"
  ON public.anomaly_history
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.anomalies a
      WHERE a.id = anomaly_history.anomaly_id
      AND a.network_id = get_user_network_id(auth.uid())
    )
  );

CREATE POLICY "Network managers can create anomaly history"
  ON public.anomaly_history
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.anomalies a
      WHERE a.id = anomaly_history.anomaly_id
      AND a.network_id = get_user_network_id(auth.uid())
    )
    AND action_by = auth.uid()
  );

-- Políticas para blocked_clients
CREATE POLICY "Admins can manage blocked clients"
  ON public.blocked_clients
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Network managers can view own blocked clients"
  ON public.blocked_clients
  FOR SELECT
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );

CREATE POLICY "Network managers can block clients"
  ON public.blocked_clients
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
    AND blocked_by = auth.uid()
  );

CREATE POLICY "Network managers can update blocked clients"
  ON public.blocked_clients
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'network_manager'::app_role) 
    AND network_id = get_user_network_id(auth.uid())
  );