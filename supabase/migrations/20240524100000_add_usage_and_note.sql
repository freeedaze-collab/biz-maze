
-- Add accounting-related columns `usage` and `note` to the source transaction tables.

-- Add usage and note columns to exchange_trades
ALTER TABLE public.exchange_trades
ADD COLUMN IF NOT EXISTS usage TEXT,
ADD COLUMN IF NOT EXISTS note TEXT;

-- Add usage and note columns to wallet_transactions
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS usage TEXT,
ADD COLUMN IF NOT EXISTS note TEXT;
