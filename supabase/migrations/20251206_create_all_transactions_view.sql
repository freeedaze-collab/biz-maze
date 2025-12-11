-- supabase/migrations/20251206_create_all_transactions_view.sql
-- PURPOSE: Unified view of all transactions with normalized asset fields.

-- Drop the view if it exists for a clean rebuild
DROP VIEW IF EXISTS public.all_transactions;

-- This final, consolidated view is the single source of truth, conforming to our customer's actual schema (with disparate ID types)
CREATE OR REPLACE VIEW public.all_transactions AS

-- =================================================================
-- On-chain Transactions (FROM: public.wallet_transactions)
-- =================================================================
SELECT
    t.id::text, -- [Critical Fix] Cast UUID to TEXT
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset, -- This is the base asset
    NULL AS quote_asset, -- No quote asset for on-chain tx
    NULL AS price,       -- No price for on-chain tx
    t.direction AS type, -- 'IN' or 'OUT'
    'on-chain' as source,
    t.chain_id::text AS chain
FROM
    public.wallet_transactions t

UNION ALL

-- =================================================================
-- Exchange Trades (FROM: public.exchange_trades)
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    et.amount,
    split_part(et.symbol, '/', 1) AS asset,      -- Base asset (e.g., BTC)
    split_part(et.symbol, '/', 2) AS quote_asset, -- Quote asset (e.g., USD)
    et.price,
    et.side AS type, -- 'buy' or 'sell'
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et;
