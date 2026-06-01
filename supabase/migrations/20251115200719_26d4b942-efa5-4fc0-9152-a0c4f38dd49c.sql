-- Adicionar campo para controlar se requer comentário para enviar resposta automática
ALTER TABLE public.nps_auto_reply_rules 
ADD COLUMN require_comment BOOLEAN NOT NULL DEFAULT false;