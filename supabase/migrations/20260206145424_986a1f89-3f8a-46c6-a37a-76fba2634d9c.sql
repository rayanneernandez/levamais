-- 1. Adicionar flag de permissões ativa na rede
ALTER TABLE public.networks 
ADD COLUMN IF NOT EXISTS permissions_enabled BOOLEAN DEFAULT false;

-- 2. Inserir todos os menus do LevaLoja
INSERT INTO public.system_menus (id, name, display_name, description, route, icon, sort_order, parent_id) VALUES
-- Início
('a1000001-0000-0000-0000-000000000001', 'levaloja_dashboard', 'Dashboard', 'Visão geral da rede', '/levaloja/dashboard', 'LayoutDashboard', 1, NULL),
('a1000002-0000-0000-0000-000000000001', 'levaloja_lojas', 'Minhas Lojas', 'Gestão das lojas da rede', '/levaloja/lojas', 'Building2', 2, NULL),
('a1000003-0000-0000-0000-000000000001', 'levaloja_financeiro', 'Assinatura Leva+', 'Gestão financeira da assinatura', '/levaloja/financeiro', 'Wallet', 3, NULL),

-- Clientes & Gestão
('a1000010-0000-0000-0000-000000000001', 'levaloja_clientes', 'Clientes', 'Listagem e gestão de clientes', '/levaloja/clientes', 'Users', 10, NULL),
('a1000011-0000-0000-0000-000000000001', 'levaloja_engajamento', 'Engajamento', 'Métricas de engajamento', '/levaloja/engajamento', 'TrendingUp', 11, NULL),
('a1000012-0000-0000-0000-000000000001', 'levaloja_agenda_recompra', 'Agenda de Recompra', 'Previsão de recompras', '/levaloja/agenda-recompra', 'CalendarClock', 12, NULL),
('a1000013-0000-0000-0000-000000000001', 'levaloja_gestao_retencao', 'Gestão de Retenção', 'Gestão do programa de retenção', '/levaloja/gestao-retencao', 'HeartHandshake', 13, NULL),
('a1000014-0000-0000-0000-000000000001', 'levaloja_relatorios', 'Relatórios', 'Relatórios gerais', '/levaloja/relatorios', 'FileText', 14, NULL),

-- Marketing
('a1000020-0000-0000-0000-000000000001', 'levaloja_marketing_dashboard', 'Dashboard Marketing', 'Visão geral do marketing', '/levaloja/marketing/dashboard', 'LayoutDashboard', 20, NULL),
('a1000021-0000-0000-0000-000000000001', 'levaloja_acoes', 'Ações e Promoções', 'Campanhas e ações promocionais', '/levaloja/acoes', 'Megaphone', 21, NULL),
('a1000022-0000-0000-0000-000000000001', 'levaloja_notificacoes', 'Notificações', 'Envio de notificações', '/levaloja/marketing/notificacoes', 'Bell', 22, NULL),
('a1000023-0000-0000-0000-000000000001', 'levaloja_disparo_sms', 'Disparo de SMS', 'Envio de SMS em massa', '/levaloja/marketing/disparo-sms', 'MessageCircle', 23, NULL),
('a1000024-0000-0000-0000-000000000001', 'levaloja_impacto_insights', 'Impacto e Insights', 'Análise de impacto das ações', '/levaloja/marketing/impacto-insights', 'Lightbulb', 24, NULL),
('a1000025-0000-0000-0000-000000000001', 'levaloja_extrato_marketing', 'Extrato de Marketing', 'Histórico de gastos com marketing', '/levaloja/marketing/extrato', 'Receipt', 25, NULL),
('a1000026-0000-0000-0000-000000000001', 'levaloja_nps', 'NPS', 'Net Promoter Score', '/levaloja/marketing/nps', 'Gift', 26, NULL),

-- Leva+ One
('a1000030-0000-0000-0000-000000000001', 'levaloja_one_dashboard', 'Dashboard One', 'Visão geral do Leva+ One', '/levaloja/leva-one/dashboard', 'LayoutDashboard', 30, NULL),
('a1000031-0000-0000-0000-000000000001', 'levaloja_one_promocoes', 'Promoções One', 'Promoções exclusivas One', '/levaloja/leva-one/promocoes', 'Gift', 31, NULL),
('a1000032-0000-0000-0000-000000000001', 'levaloja_one_resgates', 'Resgates One', 'Resgates de assinantes One', '/levaloja/leva-one/resgates', 'Tag', 32, NULL),

-- Segurança & Acesso
('a1000040-0000-0000-0000-000000000001', 'levaloja_usuarios', 'Usuários', 'Gestão de usuários do sistema', '/levaloja/usuarios', 'Users', 40, NULL),
('a1000041-0000-0000-0000-000000000001', 'levaloja_perfis', 'Perfis de Acesso', 'Configuração de perfis e permissões', '/levaloja/perfis', 'Shield', 41, NULL),
('a1000042-0000-0000-0000-000000000001', 'levaloja_tags', 'Tags', 'Gestão de tags de usuários', '/levaloja/tags', 'Tag', 42, NULL),
('a1000043-0000-0000-0000-000000000001', 'levaloja_monitor_anomalias', 'Monitor de Anomalias', 'Detecção de fraudes e anomalias', '/levaloja/monitor-anomalias', 'AlertTriangle', 43, NULL),
('a1000044-0000-0000-0000-000000000001', 'levaloja_logs_auditoria', 'Logs de Auditoria', 'Histórico de ações no sistema', '/levaloja/configuracoes/logs', 'ScrollText', 44, NULL),

-- Configurações
('a1000050-0000-0000-0000-000000000001', 'levaloja_fidelidade', 'Fidelidade', 'Configuração do programa de fidelidade', '/levaloja/configuracoes/fidelidade', 'Settings', 50, NULL),
('a1000051-0000-0000-0000-000000000001', 'levaloja_produtos', 'Produtos', 'Cadastro de produtos', '/levaloja/produtos', 'Package', 51, NULL),
('a1000052-0000-0000-0000-000000000001', 'levaloja_leva_valoriza', 'Leva+Valoriza', 'Programa de incentivo a colaboradores', '/levaloja/leva-mais-valoriza', 'Gift', 52, NULL),
('a1000053-0000-0000-0000-000000000001', 'levaloja_reajuste', 'Reajuste', 'Configuração de reajustes', '/levaloja/configuracoes/reajuste', 'DollarSign', 53, NULL),
('a1000054-0000-0000-0000-000000000001', 'levaloja_whatsapp', 'WhatsApp', 'Integração com WhatsApp', '/levaloja/configuracoes/whatsapp', 'MessageCircle', 54, NULL),
('a1000055-0000-0000-0000-000000000001', 'levaloja_integracao_checkout', 'Integração Checkout', 'Integração com sistemas de checkout', '/levaloja/configuracoes/integracao-checkout', 'Plug', 55, NULL),

-- Suporte
('a1000060-0000-0000-0000-000000000001', 'levaloja_transacoes', 'Relatório de Transações', 'Visualização de transações', '/levaloja/transacoes', 'Receipt', 60, NULL),
('a1000061-0000-0000-0000-000000000001', 'levaloja_suporte', 'Suporte', 'Abertura de tickets de suporte', '/levaloja/suporte', 'HelpCircle', 61, NULL),
('a1000062-0000-0000-0000-000000000001', 'levaloja_ajuda', 'Ajuda', 'Central de ajuda', '/levaloja/ajuda', 'HelpCircle', 62, NULL)

ON CONFLICT (id) DO NOTHING;

-- 3. Comentário explicativo na coluna
COMMENT ON COLUMN public.networks.permissions_enabled IS 'Quando true, o sistema verifica permissões dos perfis de acesso para usuários desta rede';