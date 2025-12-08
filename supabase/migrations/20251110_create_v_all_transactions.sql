
-- supabase/migrations/20251110_create_v_all_transactions.sql
-- PURPOSE: Defines the consolidated transaction view for the entire application.
-- This is the single source of truth for all transaction-like activities.

-- Drop the existing view to ensure a clean replacement with the updated structure
DROP VIEW IF EXISTS public.v_all_transactions;

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
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset, -- Base asset
    NULL AS quote_asset, -- No quote asset for on-chain tx
    NULL AS price,       -- No price for on-chain tx
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
    -- Description now uses the calculated per-unit price for consistency
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' ||
      (CASE
          WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
          ELSE 0
      END)::text AS description,
    et.amount,
    split_part(et.symbol, '/', 1) AS asset,      -- Base asset (e.g., BTC)
    split_part(et.symbol, '/', 2) AS quote_asset, -- Quote asset (e.g., USD)
    -- This is the per-unit price, calculated from total cost (fee_currency) / amount
    CASE
      WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
      ELSE 0
    END AS price,
    et.side AS type, -- 'buy' or 'sell'
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et;

