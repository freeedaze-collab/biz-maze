-- supabase/migrations/20251110_create_v_all_transactions.sql
-- PURPOSE: Defines the consolidated transaction view. Fixes dependency and asset recognition issues.

-- Drop the existing view and any dependent views (like v_holdings) cleanly.
-- The dependent views will be recreated by their own migration files later in the process.
DROP VIEW IF EXISTS public.v_all_transactions CASCADE;

-- Create the definitive version of the view
CREATE OR REPLACE VIEW public.v_all_transactions AS

-- =================================================================
-- Part 1: On-chain Transactions (from public.wallet_transactions)
-- =================================================================
SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'UNKNOWN_ASSET') AS description,
    (t.value_wei / 1e18) AS amount,
    -- FIX: Default NULL asset symbols to 'UNKNOWN_ASSET' to prevent misclassification as ETH
    COALESCE(t.asset_symbol, 'UNKNOWN_ASSET') AS asset,
    NULL AS quote_asset,
    NULL AS price,
    NULL::numeric AS acquisition_price_total,
    t.direction AS type, -- 'IN' or 'OUT'
    'on-chain' as source,
    t.chain_id::text AS chain
FROM
    public.wallet_transactions t

UNION ALL

-- =================================================================
-- Part 2: Exchange Trades (from public.exchange_trades)
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' ||
      (CASE
          WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
          ELSE 0
      END)::text AS description,
    et.amount,
    split_part(et.symbol, '/', 1) AS asset,
    split_part(et.symbol, '/', 2) AS quote_asset,
    CASE
      WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
      ELSE 0
    END AS price,
    et.fee_currency::numeric AS acquisition_price_total,
    et.side AS type, -- 'buy' or 'sell'
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et;
