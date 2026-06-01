-- Criar cron job para verificar resgates agendados para desligar (roda diariamente às 6h)
SELECT cron.schedule(
  'check-scheduled-redemption-disable-daily',
  '0 6 * * *', -- Todo dia às 6h da manhã
  $$
  SELECT
    net.http_post(
        url:='https://auivszkscfcpczrkecoc.supabase.co/functions/v1/check-scheduled-redemption-disable',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aXZzemtzY2ZjcGN6cmtlY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTczMjksImV4cCI6MjA3NTg3MzMyOX0.Gz7wyWsb5NvFau6tJ_I9cce2HJm6s1o_nESHYAf3sPk"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);