-- supabase/migrations/20251203_add_usd_column.sql
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS usd_value_at_tx NUMERIC;
