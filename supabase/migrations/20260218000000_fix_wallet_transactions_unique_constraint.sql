-- Ensure the correct unique constraint exists on wallet_transactions
-- This migration is idempotent: it drops the old constraint (if any) and creates the correct one.

-- Drop any existing composite constraints that might conflict
ALTER TABLE public.wallet_transactions 
    DROP CONSTRAINT IF EXISTS wallet_transactions_composite_key;

ALTER TABLE public.wallet_transactions 
    DROP CONSTRAINT IF EXISTS wallet_transactions_tx_hash_key;

DROP INDEX IF EXISTS public.wallet_transactions_tx_hash_key;
DROP INDEX IF EXISTS public.wallet_transactions_composite_key;

-- Add the definitive unique constraint used by upsert
-- Columns: tx_hash, user_id, chain
ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_unique_tx
    UNIQUE (tx_hash, user_id, chain);
