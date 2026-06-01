-- Inserir menus do portal lojista na tabela system_menus
INSERT INTO public.system_menus (name, display_name, description, route, icon, sort_order, parent_id) VALUES
-- Menu principal
('store_dashboard', 'Dashboard', 'Painel principal com métricas gerais', '/levaloja/dashboard', 'LayoutDashboard', 1, NULL),
('store_lojas', 'Minhas Lojas', 'Gerenciamento de lojas', '/levaloja/lojas', 'Building2', 2, NULL),

-- Gestão
('store_clientes', 'Clientes', 'Gerenciamento de clientes', '/levaloja/clientes', 'Users', 10, NULL),
('store_acoes', 'Ações', 'Ações e campanhas de fidelidade', '/levaloja/acoes', 'Sparkles', 11, NULL),
('store_engajamento', 'Engajamento', 'Análise de engajamento de clientes', '/levaloja/engajamento', 'TrendingUp', 12, NULL),
('store_relatorios', 'Relatórios', 'Relatórios gerenciais', '/levaloja/relatorios', 'FileText', 13, NULL),
('store_agenda_recompra', 'Agenda de Recompra', 'Agenda de clientes para recompra', '/levaloja/agenda-recompra', 'CalendarClock', 14, NULL),

-- Marketing
('store_marketing_dashboard', 'Dashboard Marketing', 'Painel de marketing', '/levaloja/marketing/dashboard', 'LayoutDashboard', 20, NULL),
('store_marketing_email', 'Disparo de E-mail', 'Envio de e-mails em massa', '/levaloja/marketing/disparo-email', 'Mail', 21, NULL),
('store_marketing_whatsapp', 'Disparo de WhatsApp', 'Envio de mensagens WhatsApp', '/levaloja/marketing/disparo-whatsapp', 'MessageSquare', 22, NULL),

-- Acesso
('store_usuarios', 'Usuários', 'Gerenciamento de usuários', '/levaloja/usuarios', 'Users', 30, NULL),
('store_perfis', 'Perfis de Acesso', 'Gerenciamento de perfis e permissões', '/levaloja/perfis', 'Shield', 31, NULL),

-- Segurança
('store_monitor_anomalias', 'Monitor de Anomalias', 'Monitoramento de anomalias e fraudes', '/levaloja/monitor-anomalias', 'AlertTriangle', 40, NULL),

-- Configurações
('store_config_fidelidade', 'Fidelidade', 'Configurações de fidelidade', '/levaloja/configuracoes/fidelidade', 'Settings', 50, NULL),
('store_config_reajuste', 'Reajuste', 'Configurações de reajuste de preços', '/levaloja/configuracoes/reajuste', 'DollarSign', 51, NULL),
('store_config_integracao', 'Integração Checkout', 'Configurações de integração', '/levaloja/configuracoes/integracao', 'Plug', 52, NULL),
('store_config_logs', 'Logs de Auditoria', 'Logs de auditoria do sistema', '/levaloja/configuracoes/logs', 'ScrollText', 53, NULL)
ON CONFLICT (name) DO NOTHING;