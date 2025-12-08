
-- supabase/migrations/20240523110000_recreate_all_transactions_with_usd_conversion.sql
-- PURPOSE: Recreate the all_transactions view to correctly calculate value_in_usd at the time of transaction.
-- FIX: Use DROP VIEW ... CASCADE to handle dependent views.

DROP VIEW IF EXISTS public.all_transactions CASCADE;

CREATE OR REPLACE VIEW public.all_transactions AS

-- =================================================================
-- Exchange Trades (FROM: public.exchange_trades)
-- This part now correctly calculates the value in USD at the time of the trade.
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    et.amount,
    split_part(et.symbol, '/', 1) AS asset,
    split_part(et.symbol, '/', 2) AS quote_asset,
    et.price,
    -- This is the core logic for USD conversion, including fees in the total value.
    CASE
        -- If the quote currency is USD, the value is simply cost (price * amount) + fee.
        WHEN split_part(et.symbol, '/', 2) = 'USD' THEN (et.price * et.amount) + COALESCE(et.fee, 0)
        -- If the quote currency is JPY, convert to USD using the daily rate.
        WHEN split_part(et.symbol, '/', 2) = 'JPY' THEN ((et.price * et.amount) + COALESCE(et.fee, 0)) * rates.rate
        -- If the transaction already has a value_usd, use it as a fallback.
        WHEN et.value_usd IS NOT NULL THEN et.value_usd
        -- Otherwise, we cannot determine the USD value.
        ELSE NULL
    END AS value_in_usd,
    et.side AS type,
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et
-- Join with daily exchange rates on the transaction date to get the conversion rate for non-USD trades.
LEFT JOIN
    public.daily_exchange_rates rates
    ON DATE(et.ts) = rates.date
    AND rates.source_currency = split_part(et.symbol, '/', 2)
    AND rates.target_currency = 'USD'

UNION ALL

-- =================================================================
-- On-chain Transactions (FROM: public.wallet_transactions)
-- This part uses the pre-existing value_usd column.
-- =================================================================
SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset,
    'USD' AS quote_asset, -- The value is in USD
    -- Calculated price per unit in USD
    CASE
        WHEN (t.value_wei / 1e18) <> 0 THEN t.value_usd / (t.value_wei / 1e18)
        ELSE 0
    END AS price,
    t.value_usd AS value_in_usd,
    t.direction AS type,
    'on-chain' as source,
    t.chain_id::text AS chain
FROM
    public.wallet_transactions t;
