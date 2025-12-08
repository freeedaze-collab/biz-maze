
-- supabase/migrations/20240523120000_consolidated_views_rebuild.sql
-- PURPOSE: This single, definitive file rebuilds the entire view chain for transaction and holding calculations.
-- FINAL VERSION (v8) - Final Simplification & Accuracy Fix: Implements the user's final feedback to 
-- 1) radically simplify the v_holdings view to ONLY show current holdings and their accurate average cost, and
-- 2) fix the average cost calculation to only include inflows with a known acquisition price.

-- Step 1: Safely drop all potentially outdated or broken views in reverse order of dependency.
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- =================================================================
-- VIEW 1: all_transactions (The TRUE Foundation - Stable)
-- Correctly calculates `amount` (base asset quantity) and `value_in_usd` for all trade types.
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions AS
SELECT et.trade_id::text AS id, et.user_id, et.trade_id::text AS reference_id, et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    CASE WHEN et.side = 'buy' THEN et.amount WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price ELSE et.amount END AS amount,
    split_part(et.symbol, '/', 1) AS asset, split_part(et.symbol, '/', 2) AS quote_asset, et.price,
    CASE WHEN et.side = 'buy' THEN CASE WHEN split_part(et.symbol, '/', 2) = 'USD' THEN (et.price * et.amount) + COALESCE(et.fee, 0) WHEN split_part(et.symbol, '/', 2) = 'JPY' THEN ((et.price * et.amount) + COALESCE(et.fee, 0)) * rates.rate ELSE NULL END
         WHEN et.side = 'sell' THEN CASE WHEN split_part(et.symbol, '/', 2) = 'USD' THEN et.amount - COALESCE(et.fee, 0) WHEN split_part(et.symbol, '/', 2) = 'JPY' THEN (et.amount - COALESCE(et.fee, 0)) * rates.rate ELSE NULL END
         ELSE et.value_usd
    END AS value_in_usd,
    et.side AS type, 'exchange' as source, et.exchange AS chain
FROM public.exchange_trades et
LEFT JOIN public.daily_exchange_rates rates ON DATE(et.ts) = rates.date AND rates.source_currency = split_part(et.symbol, '/', 2) AND rates.target_currency = 'USD'
UNION ALL
SELECT t.id::text, t.user_id, t.tx_hash, t.timestamp,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH'),
    (t.value_wei / 1e18), COALESCE(t.asset_symbol, 'ETH'), 'USD',
    CASE WHEN (t.value_wei / 1e18) <> 0 THEN t.value_usd / (t.value_wei / 1e18) ELSE 0 END,
    t.value_usd, t.direction, 'on-chain', t.chain_id::text
FROM public.wallet_transactions t;

-- =================================================================
-- VIEW 2: v_all_transactions_classified (Stable)
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
-- VIEW 3: v_holdings (The Clean, Final, and Correct Version)
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS
WITH base_calcs AS (
    SELECT
        user_id, 
        asset,
        -- For calculating current amount, we consider all inflows and outflows.
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN COALESCE(amount, 0) ELSE 0 END) as total_inflow_amount,
        SUM(CASE WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN COALESCE(amount, 0) ELSE 0 END) as total_outflow_amount,
        
        -- ACCURATE COST BASIS: For average price, we ONLY use inflows where we have a known cost.
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(value_in_usd, 0) ELSE 0 END) as total_cost_for_priced_inflows,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(amount, 0) ELSE 0 END) as total_quantity_of_priced_inflows

    FROM public.v_all_transactions_classified
    GROUP BY user_id, asset
)
SELECT
    b.user_id, 
    b.asset,
    
    -- Final holdings columns
    (b.total_inflow_amount - b.total_outflow_amount) as current_amount,
    COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0) as current_price,
    (b.total_inflow_amount - b.total_outflow_amount) * COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0) AS current_value_usd,
    
    -- The truly correct average buy price
    (CASE WHEN b.total_quantity_of_priced_inflows > 0 THEN b.total_cost_for_priced_inflows / b.total_quantity_of_priced_inflows ELSE 0 END) as average_buy_price

FROM base_calcs b
-- Filter out assets that have been completely sold off.
WHERE (b.total_inflow_amount - b.total_outflow_amount) > 0.000001;
