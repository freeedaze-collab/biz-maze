-- Ensure all missing columns exist before views are created
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS usd_value_at_tx NUMERIC;

ALTER TABLE public.exchange_trades
ADD COLUMN IF NOT EXISTS value_usd NUMERIC,
ADD COLUMN IF NOT EXISTS fee_currency NUMERIC;
