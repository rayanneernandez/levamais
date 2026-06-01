-- Criar policy para permitir inserção pública de leads via WhatsApp
CREATE POLICY "Public can create leads via website"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  source IN ('whatsapp_button', 'website') 
  AND status = 'new'
);