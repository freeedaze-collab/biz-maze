-- v_all_transactions FINAL: Correctly handles Exchange Sells
-- This version uses raw_data->>'transactionType' to reliably distinguish buys and sells.

DROP VIEW IF EXISTS public.v_all_transactions CASCADE;

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
-- Part 2: Exchange Fiat-to-Crypto Trades (Corrected Logic)
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    -- Description now reflects the correct action (Buy or Sell)
    'Exchange: ' ||
        CASE WHEN et.raw_data->>'transactionType' = '0' THEN 'Buy ' ELSE 'Sell ' END ||
        (et.raw_data->>'obtainAmount') || ' ' || (et.raw_data->>'cryptoCurrency') AS description,
    -- The amount of crypto involved
    (et.raw_data->>'obtainAmount')::numeric AS amount,
    (et.raw_data->>'cryptoCurrency') AS asset,
    (et.raw_data->>'fiatCurrency') AS quote_asset,
    -- Price is always Fiat / Crypto
    (et.raw_data->>'sourceAmount')::numeric / (et.raw_data->>'obtainAmount')::numeric AS price,
    -- The amount of fiat involved (cost for buys, proceeds for sells)
    (et.raw_data->>'sourceAmount')::numeric AS acquisition_price_total,
    -- CORRECTED TYPE: Use transactionType from raw_data to determine 'buy' or 'sell'
    CASE
        WHEN et.raw_data->>'transactionType' = '0' THEN 'buy'
        WHEN et.raw_data->>'transactionType' = '1' THEN 'sell'
        ELSE 'unknown'
    END AS type,
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et
WHERE
    et.symbol LIKE '%/%'

UNION ALL

-- =================================================================
-- Part 3: Exchange Crypto Withdrawals (Unchanged)
-- =================================================================
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
    'OUT' AS type,
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et
WHERE
    et.side = 'withdrawal';
