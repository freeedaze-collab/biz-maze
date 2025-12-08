-- supabase/migrations/20251110_create_v_all_transactions.sql
-- PURPOSE: Final definitive version. Rebuilds logic based on raw_data JSON, ignoring inconsistent columns.

-- Drop the existing view and any dependent views (like v_holdings) cleanly.
DROP VIEW IF EXISTS public.v_all_transactions CASCADE;

-- Create the definitive version of the view
CREATE OR REPLACE VIEW public.v_all_transactions AS

-- =================================================================
-- Part 1: On-chain Transactions (Unchanged)
-- =================================================================
SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'UNKNOWN_ASSET') AS description,
    (t.value_wei / 1e18) AS amount,
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
-- Part 2: Exchange Trades - Rebuilt from raw_data
-- =================================================================
-- Section A: Fiat-to-Crypto Trades (Handles inconsistent 'buy'/'sell' side)
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    -- Description from reliable raw_data
    'Exchange: Buy ' || (et.raw_data->>'obtainAmount') || ' ' || (et.raw_data->>'cryptoCurrency') || ' with ' || (et.raw_data->>'sourceAmount') || ' ' || (et.raw_data->>'fiatCurrency') AS description,
    -- Crypto amount is always 'obtainAmount' from raw_data
    (et.raw_data->>'obtainAmount')::numeric AS amount,
    -- Asset is always 'cryptoCurrency' from raw_data
    (et.raw_data->>'cryptoCurrency') AS asset,
    (et.raw_data->>'fiatCurrency') AS quote_asset,
    -- Price is calculated reliably: fiat spent / crypto obtained
    (et.raw_data->>'sourceAmount')::numeric / (et.raw_data->>'obtainAmount')::numeric AS price,
    -- Total cost is always the fiat 'sourceAmount' from raw_data
    (et.raw_data->>'sourceAmount')::numeric AS acquisition_price_total,
    'buy' AS type, -- Based on raw_data, these are all crypto buys.
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et
WHERE
    -- Filter for trades which are identified by a '/' in the symbol
    et.symbol LIKE '%/%'

UNION ALL

-- Section B: Crypto Withdrawals
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: Withdrawal of ' || et.amount::text || ' ' || et.symbol AS description,
    et.amount,
    et.symbol AS asset,
    NULL AS quote_asset,
    NULL AS price,
    NULL::numeric AS acquisition_price_total,
    'OUT' AS type, -- This is a withdrawal, equivalent to an on-chain 'OUT'
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et
WHERE
    -- Filter for withdrawals
    et.side = 'withdrawal';
