-- Drop pg_net from public schema
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- Recreate pg_net in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;