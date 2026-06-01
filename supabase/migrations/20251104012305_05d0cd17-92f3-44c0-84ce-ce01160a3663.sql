-- Adicionar foreign keys que faltam na tabela transaction_ratings
-- Verificar e adicionar cada uma individualmente

DO $$ 
BEGIN
  -- Adicionar FK para clients se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transaction_ratings_client_id_fkey'
  ) THEN
    ALTER TABLE public.transaction_ratings
      ADD CONSTRAINT transaction_ratings_client_id_fkey 
      FOREIGN KEY (client_id) 
      REFERENCES public.clients(id) 
      ON DELETE CASCADE;
  END IF;

  -- Adicionar FK para stores se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transaction_ratings_store_id_fkey'
  ) THEN
    ALTER TABLE public.transaction_ratings
      ADD CONSTRAINT transaction_ratings_store_id_fkey 
      FOREIGN KEY (store_id) 
      REFERENCES public.stores(id) 
      ON DELETE CASCADE;
  END IF;

  -- Adicionar FK para networks se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transaction_ratings_network_id_fkey'
  ) THEN
    ALTER TABLE public.transaction_ratings
      ADD CONSTRAINT transaction_ratings_network_id_fkey 
      FOREIGN KEY (network_id) 
      REFERENCES public.networks(id) 
      ON DELETE CASCADE;
  END IF;
END $$;