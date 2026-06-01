-- Função para incrementar rate limit de WhatsApp
CREATE OR REPLACE FUNCTION public.increment_whatsapp_rate_limit(
  p_network_id UUID,
  p_window_start TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.whatsapp_rate_limits (network_id, window_start, messages_sent)
  VALUES (p_network_id, p_window_start, 1)
  ON CONFLICT (network_id, window_start)
  DO UPDATE SET 
    messages_sent = whatsapp_rate_limits.messages_sent + 1,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';