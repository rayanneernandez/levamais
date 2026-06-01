-- Limpar menus antigos e recriar com os menus reais do Admin
DELETE FROM profile_permissions;
DELETE FROM system_menus;

-- Inserir menus reais do AdminSidebar
INSERT INTO system_menus (name, display_name, description, icon, route, sort_order) VALUES
-- Dashboard
('admin_dashboard', 'Dashboard', 'Painel principal administrativo', 'LayoutDashboard', '/adm', 1),

-- Cadastro
('admin_empresas', 'Empresas', 'Gerenciamento de redes/empresas', 'Building2', '/adm/empresas', 10),
('admin_licencas', 'Licenças', 'Configuração de licenças', 'FileText', '/adm/licencas', 11),
('admin_lojas', 'Lojas', 'Gerenciamento de lojas', 'Store', '/adm/lojas', 12),
('admin_clientes', 'Clientes', 'Gerenciamento de clientes', 'Users', '/adm/clientes', 13),
('admin_transferencias', 'Transferências de Rede', 'Transferências entre redes', 'GitBranch', '/adm/transferencias-rede', 14),
('admin_revendas', 'Revendas', 'Gerenciamento de revendas', 'Store', '/adm/revendas', 15),

-- Comercial
('admin_dashboard_comercial', 'Dashboard Comercial', 'Dashboard do comercial', 'TrendingUp', '/adm/dashboard-comercial', 20),
('admin_leads', 'LEADs', 'Gerenciamento de leads', 'Users', '/adm/leads', 21),
('admin_produtos_servicos', 'Produtos/Serviços', 'Catálogo de produtos e serviços', 'Package', '/adm/produtos-servicos', 22),
('admin_categorias', 'Categorias', 'Categorias de produtos', 'Tag', '/adm/categorias', 23),
('admin_orcamentos', 'Orçamentos', 'Gerenciamento de orçamentos', 'FileText', '/adm/orcamentos', 24),

-- Integração
('admin_transacoes', 'Transações', 'Histórico de transações', 'ArrowLeftRight', '/adm/transacoes', 30),
('admin_vendas', 'Vendas', 'Gerenciamento de vendas', 'ShoppingCart', '/adm/vendas', 31),
('admin_mensagens_api', 'Mensagens API', 'Templates de mensagens', 'MessageSquare', '/adm/mensagens-api', 32),
('admin_whatsapp', 'WhatsApp', 'Disparo de WhatsApp', 'MessageCircle', '/adm/whatsapp', 33),
('admin_api_docs', 'Swagger / Docs API', 'Documentação da API', 'BookOpen', '/adm/api-docs', 34),

-- Atendimento
('admin_suporte', 'Suporte', 'Tickets de suporte', 'Headphones', '/adm/suporte', 40),
('admin_projetos', 'Projetos', 'Gerenciamento de projetos', 'Package', '/adm/projetos', 41),
('admin_manual', 'Manual', 'Manual do sistema', 'BookOpen', '/adm/manual', 42),

-- Preço Combustível
('admin_preco_combustivel', 'Preço Combustível', 'Preços de combustíveis', 'Fuel', '/adm/preco-combustivel', 50),

-- Financeiro
('admin_financeiro', 'Gestão de Cobranças', 'Cobranças e faturas', 'Receipt', '/adm/financeiro', 60),
('admin_financeiro_dashboard', 'Dashboard Financeiro', 'Dashboard financeiro', 'TrendingUp', '/adm/financeiro/dashboard', 61),
('admin_planos', 'Planos', 'Planos e preços', 'Package', '/adm/financeiro/planos', 62),
('admin_asaas_config', 'Configuração Asaas', 'Configuração do gateway', 'CreditCard', '/adm/configuracoes/asaas', 63),
('admin_asaas_tests', 'Testes Asaas', 'Testes de integração', 'Shield', '/adm/configuracoes/asaas-tests', 64),
('admin_webhook_logs', 'Logs Webhook', 'Logs de webhooks', 'Webhook', '/adm/leva-one/webhook-logs', 65),

-- Leva+ One
('admin_one_dashboard', 'Dashboard One', 'Dashboard Leva+ One', 'Star', '/adm/leva-one/dashboard', 70),
('admin_one_assinaturas', 'Assinaturas One', 'Gestão de assinaturas', 'CreditCard', '/adm/leva-one/assinaturas', 71),
('admin_one_pagamentos', 'Pagamentos One', 'Pagamentos de assinaturas', 'DollarSign', '/adm/leva-one/pagamentos', 72),
('admin_one_resgates', 'Resgates One', 'Resgates de promoções', 'Gift', '/adm/leva-one/resgates', 73),
('admin_one_promocoes', 'Promoções PDV', 'Promoções no PDV', 'ShoppingCart', '/adm/leva-one/promocoes-pdv', 74),
('admin_one_comissao', 'Comissão One', 'Configuração de comissões', 'Percent', '/adm/leva-one/config', 75),

-- Segurança
('admin_usuarios', 'Usuários', 'Gerenciamento de usuários', 'Users', '/adm/usuarios', 80),
('admin_perfis', 'Perfis de Acesso', 'Perfis e permissões', 'Shield', '/adm/perfis', 81),
('admin_logs_auditoria', 'Logs de Auditoria', 'Logs de auditoria', 'ScrollText', '/adm/logs-auditoria', 82),
('admin_logs_sms', 'Logs SMS', 'Logs de SMS', 'MessageSquare', '/adm/logs-sms', 83),
('admin_monitoramento', 'Monitoramento', 'Monitoramento do sistema', 'Activity', '/adm/monitoramento', 84),
('admin_anomalias', 'Monitor de Anomalias', 'Detecção de anomalias', 'AlertTriangle', '/adm/monitor-anomalias', 85),

-- Configurações
('admin_api_keys', 'Chaves de API', 'Gerenciamento de API keys', 'Key', '/adm/api', 90),
('admin_testes_email', 'Testes de E-mail', 'Testes de envio de email', 'Mail', '/adm/testes-email', 91),
('admin_testes_sistema', 'Testes do Sistema', 'Testes automatizados', 'ClipboardCheck', '/adm/testes-sistema', 92),
('admin_versoes', 'Versões', 'Histórico de versões', 'GitBranch', '/adm/versoes', 93);