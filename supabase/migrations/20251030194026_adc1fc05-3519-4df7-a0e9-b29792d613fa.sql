-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job para verificar compromissos expirando (roda diariamente às 9h)
SELECT cron.schedule(
  'check-expiring-commitments-daily',
  '0 9 * * *', -- Todo dia às 9h da manhã
  $$
  SELECT
    net.http_post(
        url:='https://auivszkscfcpczrkecoc.supabase.co/functions/v1/check-expiring-commitments',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aXZzemtzY2ZjcGN6cmtlY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTczMjksImV4cCI6MjA3NTg3MzMyOX0.Gz7wyWsb5NvFau6tJ_I9cce2HJm6s1o_nESHYAf3sPk"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);