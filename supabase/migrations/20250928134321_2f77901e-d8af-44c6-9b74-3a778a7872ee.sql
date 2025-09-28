-- Update transactions table to match standardized schema
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS chain_id INTEGER,
ADD COLUMN IF NOT EXISTS network TEXT,
ADD COLUMN IF NOT EXISTS log_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('in', 'out', 'self')),
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('native', 'erc20', 'erc721', 'erc1155', 'swap', 'bridge', 'fee', 'other')),
ADD COLUMN IF NOT EXISTS asset_contract TEXT,
ADD COLUMN IF NOT EXISTS asset_symbol TEXT,
ADD COLUMN IF NOT EXISTS asset_decimals INTEGER,
ADD COLUMN IF NOT EXISTS fee_native NUMERIC,
ADD COLUMN IF NOT EXISTS usd_value_at_tx NUMERIC,
ADD COLUMN IF NOT EXISTS usd_fee_at_tx NUMERIC,
ADD COLUMN IF NOT EXISTS price_source TEXT,
ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMPTZ DEFAULT now();

-- Update existing columns to match schema
ALTER TABLE public.transactions 
ALTER COLUMN blockchain_network SET NOT NULL,
ALTER COLUMN transaction_hash SET NOT NULL;

-- Add unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique 
ON public.transactions (chain_id, transaction_hash, log_index);

-- Add composite index for user queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_time 
ON public.transactions (user_id, transaction_date DESC);

-- Add index for chain queries
CREATE INDEX IF NOT EXISTS idx_transactions_chain 
ON public.transactions (chain_id);

-- Add index for network queries  
CREATE INDEX IF NOT EXISTS idx_transactions_network 
ON public.transactions (network);

-- Update wallet_connections to track sync status per chain
ALTER TABLE public.wallet_connections
ADD COLUMN IF NOT EXISTS chain_last_synced_at JSONB DEFAULT '{}';

-- Add environment secrets placeholders (will need to be set manually)
-- ALCHEMY_API_KEY, COVALENT_API_KEY, COINGECKO_API_BASE will be added as secrets