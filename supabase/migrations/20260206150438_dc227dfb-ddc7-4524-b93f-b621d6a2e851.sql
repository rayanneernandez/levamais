-- Adicionar menu de Disparo WhatsApp na tabela system_menus
INSERT INTO system_menus (id, name, display_name, description, route, icon, sort_order)
VALUES (
  'a1000023-0000-0000-0000-000000000002',
  'levaloja_disparo_whatsapp',
  'Disparo de WhatsApp',
  'Envio de campanhas via WhatsApp',
  '/levaloja/marketing/disparo-whatsapp',
  'MessageCircle',
  23.5
);