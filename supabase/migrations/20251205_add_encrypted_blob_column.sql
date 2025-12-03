-- supabase/migrations/20251205_add_encrypted_blob_column.sql

ALTER TABLE public.exchange_connections
ADD COLUMN IF NOT EXISTS encrypted_blob TEXT;
