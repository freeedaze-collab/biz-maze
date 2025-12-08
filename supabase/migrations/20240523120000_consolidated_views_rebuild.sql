-- supabase/migrations/20240523120000_consolidated_views_rebuild.sql
-- PURPOSE: Introduces acquisition_price_total for clearer, more accurate cost basis calculation.
-- VERSION: 13

-- Step 1: Safely drop views in reverse order of dependency.
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- =================================================================
-- VIEW 1: all_transactions (Revised with acquisition_price_total)
-- This version introduces a dedicated column for the cost in the original quote currency,
-- then converts it to USD, making the logic clearer and more accurate.
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions AS
-- Exchange Trades
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,

    -- This correctly represents the amount of the base asset.
    -- For 'sell', amount is in quote currency, so we convert it to the base asset amount.
    CASE
        WHEN et.side = 'buy' THEN et.amount
        WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price
        ELSE et.amount
    END AS amount,

    split_part(et.symbol, '/', 1) AS asset,
    split_part(et.symbol, '/', 2) AS quote_asset,
    et.price,

    -- Step 1: Calculate the total acquisition price in the original quote currency.
    CASE
        WHEN et.side = 'buy' THEN (et.price * et.amount) + COALESCE(et.fee, 0)
        -- For 'sell', the 'cost' is what was received, less fees.
        WHEN et.side = 'sell' THEN et.amount - COALESCE(et.fee, 0)
        ELSE NULL
    END AS acquisition_price_total,

    -- Step 2: Convert the acquisition price to USD.
    -- Fallback to et.value_usd if direct calculation is not possible.
    COALESCE(
        CASE
            WHEN split_part(et.symbol, '/', 2) = 'USD' THEN
                -- If quote is USD, acquisition price is already in USD.
                CASE
                    WHEN et.side = 'buy' THEN (et.price * et.amount) + COALESCE(et.fee, 0)
                    WHEN et.side = 'sell' THEN et.amount - COALESCE(et.fee, 0)
                    ELSE NULL
                END
            ELSE
                -- If quote is not USD (e.g., JPY), convert using the rate.
                (CASE
                    WHEN et.side = 'buy' THEN (et.price * et.amount) + COALESCE(et.fee, 0)
                    WHEN et.side = 'sell' THEN et.amount - COALESCE(et.fee, 0)
                    ELSE NULL
                END) * rates.rate
        END,
        et.value_usd -- The crucial fallback
    ) AS value_in_usd,

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
    t.id::text,
    t.user_id,
    t.tx_hash,
    t.timestamp,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH'),
    (t.value_wei / 1e18),
    COALESCE(t.asset_symbol, 'ETH'),
    'USD', -- Quote asset is always USD for on-chain
    -- Price per unit asset
    CASE WHEN (t.value_wei / 1e18) <> 0 THEN t.value_usd / (t.value_wei / 1e18) ELSE 0 END,
    -- Acquisition price is the total USD value
    t.value_usd AS acquisition_price_total,
    t.value_usd AS value_in_usd,
    t.direction,
    'on-chain',
    t.chain_id::text
FROM public.wallet_transactions t;

-- =================================================================
-- VIEW 2: v_all_transactions_classified (No changes needed)
-- This view simply categorizes the transaction types from the base view.
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
-- VIEW 3: v_holdings (No changes needed)
-- This view correctly calculates holdings based on the improved data from all_transactions.
-- The calculation for average_buy_price now relies on the more robust `value_in_usd`.
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS
WITH base_calcs AS (
    SELECT
        user_id,
        asset,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN COALESCE(amount, 0) ELSE 0 END) as total_inflow_amount,
        SUM(CASE WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN COALESCE(amount, 0) ELSE 0 END) as total_outflow_amount,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(value_in_usd, 0) ELSE 0 END) as total_cost_for_priced_inflows,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(amount, 0) ELSE 0 END) as total_quantity_of_priced_inflows
    FROM public.v_all_transactions_classified
    GROUP BY user_id, asset
)
SELECT
    b.user_id,
    b.asset,
    (b.total_inflow_amount - b.total_outflow_amount) as current_amount,
    COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0) as current_price,
    (b.total_inflow_amount - b.total_outflow_amount) * COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0) AS current_value_usd,
    (CASE WHEN b.total_quantity_of_priced_inflows > 0 THEN b.total_cost_for_priced_inflows / b.total_quantity_of_priced_inflows ELSE 0 END) as average_buy_price
FROM base_calcs b
WHERE (b.total_inflow_amount - b.total_outflow_amount) > 0.000001; -- Use a small threshold to avoid floating point inaccuracies
