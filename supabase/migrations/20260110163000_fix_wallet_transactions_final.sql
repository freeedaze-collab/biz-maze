-- Final, definitive fix for wallet_transactions to satisfy ALL consumers (View, Journal, Sync)
-- Adds all identified aliases and missing columns.

ALTER TABLE public.wallet_transactions
-- Columns required by 'generate-journal-entries' and 'all_transactions' view
ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMP WITH TIME ZONE, -- used by journal
ADD COLUMN IF NOT EXISTS direction TEXT, -- used by View/Journal (vs 'type')
ADD COLUMN IF NOT EXISTS asset_symbol TEXT, -- used by View/Journal (vs 'asset')
ADD COLUMN IF NOT EXISTS fiat_value_usd NUMERIC, -- used by Journal (vs 'value_in_usd')

-- Columns required by 'all_transactions' View
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE, -- used by View (vs 'date')
ADD COLUMN IF NOT EXISTS tx_hash TEXT, -- used by View
ADD COLUMN IF NOT EXISTS value_wei NUMERIC, -- used by View (vs 'amount')
ADD COLUMN IF NOT EXISTS chain_id BIGINT, -- used by View (vs 'chain')
ADD COLUMN IF NOT EXISTS wallet_address TEXT, -- used by View

-- Columns required by User/Error
ADD COLUMN IF NOT EXISTS asset_decimals INTEGER, -- Explicitly requested

-- Ensure standard columns exist (just in case)
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Grant permissions again just to be safe
GRANT ALL ON TABLE public.wallet_transactions TO service_role;
GRANT ALL ON TABLE public.wallet_transactions TO authenticated;
