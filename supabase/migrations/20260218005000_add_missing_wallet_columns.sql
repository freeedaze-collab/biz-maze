-- Migration: Add log_index and token_address to wallet_transactions
-- These are required for multi-transfer transactions and accurate token identification

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS log_index INTEGER,
ADD COLUMN IF NOT EXISTS token_address TEXT;

-- Index for log_index to speed up classification views
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_log_index ON public.wallet_transactions (log_index);
