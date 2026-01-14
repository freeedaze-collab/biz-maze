-- Add chain column to wallet_connections if it doesn't exist
ALTER TABLE public.wallet_connections 
ADD COLUMN IF NOT EXISTS chain TEXT DEFAULT 'ethereum';

-- Grant permissions for exchange_connections to service_role (fix for 42501 error)
GRANT ALL ON TABLE public.exchange_connections TO service_role;
GRANT ALL ON TABLE public.exchange_connections TO postgres;
GRANT ALL ON TABLE public.exchange_connections TO authenticated;

-- Ensure RLS is enabled but policyies are correct (existing policies should be fine, but grants were missing)
ALTER TABLE public.exchange_connections ENABLE ROW LEVEL SECURITY;
