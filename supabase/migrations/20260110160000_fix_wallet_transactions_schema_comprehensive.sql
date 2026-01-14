-- Comprehensive fix for wallet_transactions to match Moralis Sync Function and Frontend View Requirements
-- This addresses missing 'asset_decimals' and other potential gaps.

ALTER TABLE public.wallet_transactions
-- 1. Chain (Function sends 'chain' string)
ADD COLUMN IF NOT EXISTS chain TEXT,

-- 2. Amount (Function sends 'amount' numeric)
ADD COLUMN IF NOT EXISTS amount NUMERIC,

-- 3. Date (Function sends 'date')
ADD COLUMN IF NOT EXISTS date TIMESTAMP WITH TIME ZONE,

-- 4. Asset (Function sends 'asset')
ADD COLUMN IF NOT EXISTS asset TEXT,

-- 5. Value in USD (Function sends 'value_in_usd')
ADD COLUMN IF NOT EXISTS value_in_usd NUMERIC,

-- 6. Type (Function sends 'type')
ADD COLUMN IF NOT EXISTS type TEXT,

-- 7. Description (Function sends 'description')
ADD COLUMN IF NOT EXISTS description TEXT,

-- 8. Source (Function sends 'source')
ADD COLUMN IF NOT EXISTS source TEXT,

-- 9. Addresses (Function upserts these)
ADD COLUMN IF NOT EXISTS from_address TEXT,
ADD COLUMN IF NOT EXISTS to_address TEXT,

-- 10. Missing column causing frontend error 'Could not find asset_decimals'
ADD COLUMN IF NOT EXISTS asset_decimals INTEGER,

-- 11. Extra useful fields for completeness
ADD COLUMN IF NOT EXISTS fee NUMERIC,
ADD COLUMN IF NOT EXISTS fee_currency TEXT,
ADD COLUMN IF NOT EXISTS nonce BIGINT,
ADD COLUMN IF NOT EXISTS method_id TEXT,
ADD COLUMN IF NOT EXISTS block_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Standard columns
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Ensure permissions
GRANT ALL ON TABLE public.wallet_transactions TO service_role;
GRANT ALL ON TABLE public.wallet_transactions TO authenticated;
