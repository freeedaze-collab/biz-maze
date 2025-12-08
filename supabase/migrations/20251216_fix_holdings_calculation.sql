-- supabase/migrations/20251214_add_identifiers_to_view.sql
-- PURPOSE: Add wallet_address and connection_name, AND critically, fix the amount calculation for SELL trades.

-- Drop the view and dependent views to redefine the base structure.
DROP VIEW IF EXISTS public.all_transactions CASCADE;

CREATE OR REPLACE VIEW public.all_transactions AS

-- =================================================================
-- On-chain Transactions (FROM: public.wallet_transactions)
-- This part remains unchanged.
-- =================================================================
SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset,
    NULL AS quote_asset,
    NULL AS price, -- On-chain transactions don't have a direct price.
    t.direction AS type,
    'on-chain' as source,
    t.chain_id::text AS chain,
    t.wallet_address,
    NULL::text AS connection_name
FROM
    public.wallet_transactions t

UNION ALL

-- =================================================================
-- Exchange Trades (FROM: public.exchange_trades)
-- ★★★ THIS SECTION IS NOW CORRECTED ★★★
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    -- Description remains as is, for human readability.
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,

    -- ★ CRUCIAL FIX: Calculate the amount of the BASE asset correctly.
    CASE
        WHEN et.side = 'buy' THEN et.amount -- For buys, amount is already the base asset quantity.
        WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price -- For sells, calculate base asset quantity from quote amount and price.
        ELSE 0 -- If price is zero for a sell, we cannot know the amount, so default to 0.
    END AS amount,

    split_part(et.symbol, '/', 1) AS asset, -- e.g., 'BTC' from 'BTC/JPY'
    split_part(et.symbol, '/', 2) AS quote_asset, -- e.g., 'JPY' from 'BTC/JPY'

    -- ★ FIX: Use the actual price from the exchange_trades table.
    et.price,

    et.side AS type, -- 'buy' or 'sell'
    'exchange' as source,
    et.exchange AS chain,
    NULL::text AS wallet_address,
    ec.connection_name
FROM
    public.exchange_trades et
LEFT JOIN
    public.exchange_connections ec ON et.exchange_connection_id = ec.id;
