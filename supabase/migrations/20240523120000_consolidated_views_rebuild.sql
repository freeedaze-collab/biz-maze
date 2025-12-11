-- supabase/migrations/20240523120000_consolidated_views_rebuild.sql
-- PURPOSE: Fixes a bug in saving on-chain transactions and ensures unique view IDs.
-- VERSION: 19

-- Step 1: Safely drop views in reverse order of dependency.
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- =================================================================
-- VIEW 1: all_transactions (FIXED)
-- Fix: Use `t.id` for on-chain `reference_id` instead of `t.tx_hash`.
-- Fix: Prefixed view `id` to guarantee uniqueness across sources.
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions AS
-- Exchange Trades (via CTE)
WITH trades_with_acquisition_price AS (
    SELECT
        * ,
        split_part(symbol, '/', 2) AS quote_asset,
        CASE
            WHEN side = 'buy' THEN (price * amount) + COALESCE(fee, 0)
            WHEN side = 'sell' THEN amount - COALESCE(fee, 0)
            ELSE NULL
        END AS acquisition_price_total
    FROM public.exchange_trades
)
SELECT
    ('exchange-' || et.trade_id)::text AS id, -- Prefixed for uniqueness
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    CASE
        WHEN et.side = 'buy' THEN et.amount
        WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price
        ELSE et.amount
    END AS amount,
    split_part(et.symbol, '/', 1) AS asset,
    et.quote_asset,
    et.price,
    et.acquisition_price_total,
    CASE
        WHEN et.quote_asset = 'USD' THEN et.acquisition_price_total
        ELSE et.acquisition_price_total * rates.rate
    END AS value_in_usd,
    et.side AS type,
    'exchange' as source,
    et.exchange AS chain,
    et.usage,
    et.note
FROM trades_with_acquisition_price et
LEFT JOIN public.daily_exchange_rates rates
    ON DATE(et.ts) = rates.date
    AND rates.source_currency = et.quote_asset
    AND rates.target_currency = 'USD'

UNION ALL

-- On-chain Transactions
SELECT
    ('onchain-' || t.id)::text as id, -- Prefixed for uniqueness
    t.user_id,
    t.id::text as reference_id, -- CORRECT: Use the wallet_transactions primary key
    t.timestamp as date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') as description,
    (t.value_wei / 1e18) as amount,
    COALESCE(t.asset_symbol, 'ETH') as asset,
    'USD' as quote_asset,
    CASE WHEN (t.value_wei / 1e18) <> 0 THEN t.value_usd / (t.value_wei / 1e18) ELSE 0 END as price,
    t.value_usd AS acquisition_price_total,
    t.value_usd AS value_in_usd,
    t.direction as type,
    'on-chain' as source,
    t.chain_id::text as chain,
    t.usage,
    t.note
FROM public.wallet_transactions t;

-- =================================================================
-- VIEW 2: v_all_transactions_classified (No changes needed)
-- =================================================================
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
SELECT t.*, CASE
    WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
    WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' OR t.type = 'IN' THEN 'DEPOSIT'
    WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' OR t.type = 'OUT' THEN 'WITHDRAWAL'
    ELSE 'OTHER'
END as transaction_type
FROM public.all_transactions t;

-- =================================================================
-- VIEW 3: v_holdings (No changes needed for this step)
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS
WITH base_calcs AS (
    SELECT
        user_id, asset,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN COALESCE(amount, 0) ELSE 0 END) as total_inflow_amount,
        SUM(CASE WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN COALESCE(amount, 0) ELSE 0 END) as total_outflow_amount,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(value_in_usd, 0) ELSE 0 END) as total_cost_for_priced_inflows,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(amount, 0) ELSE 0 END) as total_quantity_of_priced_inflows
    FROM public.v_all_transactions_classified
    GROUP BY user_id, asset
)
SELECT
    b.user_id, b.asset,
    (b.total_inflow_amount - b.total_outflow_amount) as current_amount,
    COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0) as current_price,
    (b.total_inflow_amount - b.total_outflow_amount) * COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0) AS current_value_usd,
    (CASE WHEN b.total_quantity_of_priced_inflows > 0 THEN b.total_cost_for_priced_inflows / b.total_quantity_of_priced_inflows ELSE 0 END) as average_buy_price,
    ((b.total_inflow_amount - b.total_outflow_amount) * COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0)) - ((b.total_inflow_amount - b.total_outflow_amount) * (CASE WHEN b.total_quantity_of_priced_inflows > 0 THEN b.total_cost_for_priced_inflows / b.total_quantity_of_priced_inflows ELSE 0 END)) as capital_gain
FROM base_calcs b
WHERE (b.total_inflow_amount - b.total_outflow_amount) > 0.000001;
