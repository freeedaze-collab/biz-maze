-- Add wallet verification tracking to wallet_connections table
ALTER TABLE public.wallet_connections 
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS verification_signature text;