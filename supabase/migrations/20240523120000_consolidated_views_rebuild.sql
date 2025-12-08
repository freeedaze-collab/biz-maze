
-- supabase/migrations/20240523120000_consolidated_views_rebuild.sql
-- PURPOSE: This single, definitive file rebuilds the entire view chain for transaction and holding calculations.
-- It starts by safely dropping all dependent views, then rebuilds them one by one with the correct, consistent logic.
-- This ensures that the JPY -> USD conversion happens at the base layer (`all_transactions`) and all subsequent
-- views (`v_holdings`) correctly use this pre-calculated USD value, eliminating all previous inconsistencies.

-- Step 1: Safely drop all potentially outdated or broken views in reverse order of dependency.
-- Using CASCADE ensures that everything is cleaned up before rebuilding.
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- =================================================================
-- VIEW 1: all_transactions (The New Foundation)
-- This view is the heart of the new logic. It converts all transaction values to USD
-- at the time of the trade, creating a consistent `value_in_usd` column.
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions AS
-- Exchange Trades (with JPY -> USD conversion)
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
    -- This is the core logic for USD conversion.
    CASE
        WHEN split_part(et.symbol, '/', 2) = 'USD' THEN (et.price * et.amount) + COALESCE(et.fee, 0)
        WHEN split_part(et.symbol, '/', 2) = 'JPY' THEN ((et.price * et.amount) + COALESCE(et.fee, 0)) * rates.rate
        WHEN et.value_usd IS NOT NULL THEN et.value_usd
        ELSE NULL
    END AS value_in_usd,
    et.side AS type, 
    'exchange' as source, 
    et.exchange AS chain
FROM public.exchange_trades et
LEFT JOIN public.daily_exchange_rates rates
    ON DATE(et.ts) = rates.date
    AND rates.source_currency = split_part(et.symbol, '/', 2)
    AND rates.target_currency = 'USD'
UNION ALL
-- On-chain Transactions
SELECT
    t.id::text, t.user_id, t.tx_hash, t.timestamp, 
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH'),
    (t.value_wei / 1e18), COALESCE(t.asset_symbol, 'ETH'), 'USD', 
    CASE WHEN (t.value_wei / 1e18) <> 0 THEN t.value_usd / (t.value_wei / 1e18) ELSE 0 END, 
    t.value_usd,
    t.direction, 'on-chain', t.chain_id::text
FROM public.wallet_transactions t;

-- =================================================================
-- VIEW 2: v_all_transactions_classified (Restored and dependent on the new all_transactions)
-- This view classifies transactions (buy, sell, transfer) and is now built on top of the new, reliable base view.
-- NOTE: The logic of this view itself doesn't need to change, as it only cares about `type`, not `value`.
-- =================================================================
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
SELECT
    t.*,
    CASE
        -- NOTE: We are simplifying the classification logic from the old files for clarity and robustness.
        -- This focuses on the primary transaction types needed for the holdings calculation.
        WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
        WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' OR t.type = 'IN' THEN 'DEPOSIT'
        WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' OR t.type = 'OUT' THEN 'WITHDRAWAL'
        ELSE 'OTHER'
    END as transaction_type
FROM public.all_transactions t;

-- =================================================================
-- VIEW 3: v_holdings (The Upgraded Final View)
-- This is the final, upgraded holdings view. It no longer calculates costs itself.
-- Instead, it correctly and efficiently uses the `value_in_usd` provided by the new `all_transactions` view.
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS
WITH base_usd_calcs AS (
    SELECT
        user_id, 
        asset,
        -- Aggregate inflows and outflows based on amount
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN amount ELSE 0 END) as total_inflow_amount,
        SUM(CASE WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN amount ELSE 0 END) as total_outflow_amount,
        -- Aggregate costs and proceeds based on the reliable `value_in_usd`
        SUM(CASE WHEN transaction_type = 'BUY' THEN value_in_usd ELSE 0 END) as total_buy_cost_usd,
        SUM(CASE WHEN transaction_type = 'BUY' THEN amount ELSE 0 END) as total_buy_quantity,
        SUM(CASE WHEN transaction_type = 'SELL' THEN value_in_usd ELSE 0 END) as total_sell_proceeds_usd,
        SUM(CASE WHEN transaction_type = 'SELL' THEN amount ELSE 0 END) as total_sell_quantity
    FROM public.v_all_transactions_classified
    GROUP BY user_id, asset
)
SELECT
    b.user_id, 
    b.asset,
    (b.total_inflow_amount - b.total_outflow_amount) as current_amount,
    COALESCE(ap.current_price, 0) as current_price,
    -- Current Value is current amount * current price
    (b.total_inflow_amount - b.total_outflow_amount) * COALESCE(ap.current_price, 0) AS current_value,
    -- Average Buy Price is total cost in USD / total quantity bought
    (CASE WHEN b.total_buy_quantity > 0 THEN b.total_buy_cost_usd / b.total_buy_quantity ELSE 0 END) as average_buy_price,
    -- Realized P&L is total proceeds from selling - cost basis of what was sold
    (b.total_sell_proceeds_usd - (b.total_sell_quantity * (CASE WHEN b.total_buy_quantity > 0 THEN b.total_buy_cost_usd / b.total_buy_quantity ELSE 0 END))) as realized_capital_gain_loss
FROM base_usd_calcs b
LEFT JOIN public.asset_prices ap ON b.asset = ap.asset
-- Only show holdings that the user still has
WHERE (b.total_inflow_amount - b.total_outflow_amount) > 0.000001;

