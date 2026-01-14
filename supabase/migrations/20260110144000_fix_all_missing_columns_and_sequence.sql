-- Add all potentially missing columns to wallet_connections
ALTER TABLE public.wallet_connections
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_status TEXT,
ADD COLUMN IF NOT EXISTS network TEXT; -- Adding this to satisfy potential legacy/mismatched function calls

-- Fix permissions for sequences (for exchange linking)
-- Specifically for exchange_connections_id_seq which is created by BIGSERIAL
GRANT ALL ON SEQUENCE public.exchange_connections_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.exchange_connections_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.exchange_connections_id_seq TO authenticated;
