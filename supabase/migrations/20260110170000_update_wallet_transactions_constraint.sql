-- Fix unique constraint to match upsert logic and support multi-chain/multi-user
-- Drops the single 'tx_hash' unique constraint and replaces it with a composite one.

-- Dropping the old constraint (name inferred from 'tx_hash text unique')
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_tx_hash_key;

-- Also drop unique index if it exists separately (just in case)
DROP INDEX IF EXISTS public.wallet_transactions_tx_hash_key;

-- Add new composite unique constraint including chain
ALTER TABLE public.wallet_transactions 
ADD CONSTRAINT wallet_transactions_composite_key UNIQUE (tx_hash, user_id, chain);
