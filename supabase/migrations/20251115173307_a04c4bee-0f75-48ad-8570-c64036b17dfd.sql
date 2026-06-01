-- Adicionar configurações de uso para WhatsApp
INSERT INTO public.api_usage_configs (config_type, integration_id, is_active)
VALUES 
  ('internal_whatsapp', NULL, false),
  ('client_whatsapp', NULL, false)
ON CONFLICT (config_type) DO NOTHING;