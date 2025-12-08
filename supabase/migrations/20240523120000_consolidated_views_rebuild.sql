
-- supabase/migrations/20240523120000_consolidated_views_rebuild.sql
-- PURPOSE: This single, definitive file rebuilds the entire view chain for transaction and holding calculations.
-- FINAL VERSION (v9) - The ABSOLUTE FINAL FIX: Corrects the acquisition cost calculation for BUY orders, 
-- recognizing that the `amount` in `exchange_trades` is the quote currency value for BOTH buys and sells.
-- This makes the logic symmetrical and finally fixes `average_buy_price`.

-- Step 1: Safely drop all potentially outdated or broken views in reverse order of dependency.
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- =================================================================
-- VIEW 1: all_transactions (The PERFECTED Foundation)
-- This version makes the BUY and SELL logic symmetrical, as it was discovered that `amount` for exchange
-- trades is ALWAYS the value in the quote currency (e.g., JPY or USD spent/received).
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions AS
SELECT 
    et.trade_id::text AS id, 
    et.user_id, 
    et.trade_id::text AS reference_id, 
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    
    -- THE FINAL, SYMMETRICAL AMOUNT CALCULATION
    -- For both BUY and SELL, the actual asset quantity is the quote currency amount / price.
    CASE 
        WHEN et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price
        ELSE 0 -- Avoid division by zero and handle cases where price isn't available
    END AS amount, 
    
    split_part(et.symbol, '/', 1) AS asset, 
    split_part(et.symbol, '/', 2) AS quote_asset, 
    et.price,
    
    -- THE FINAL, SYMMETRICAL VALUE CALCULATION
    -- For both BUY and SELL, the `amount` field *is* the value, which we convert to USD.
    CASE 
        WHEN split_part(et.symbol, '/', 2) = 'USD' THEN 
            CASE WHEN et.side = 'buy' THEN et.amount + COALESCE(et.fee, 0) ELSE et.amount - COALESCE(et.fee, 0) END
        WHEN split_part(et.symbol, '/', 2) = 'JPY' THEN 
            (CASE WHEN et.side = 'buy' THEN et.amount + COALESCE(et.fee, 0) ELSE et.amount - COALESCE(et.fee, 0) END) * rates.rate
        ELSE et.value_usd
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

-- On-chain Transactions (remains correct)
SELECT 
    t.id::text, t.user_id, t.tx_hash, t.timestamp, 
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH'),
    (t.value_wei / 1e18), 
    COALESCE(t.asset_symbol, 'ETH'), 
    'USD', 
    CASE WHEN (t.value_wei / 1e18) <> 0 THEN t.value_usd / (t.value_wei / 1e18) ELSE 0 END, 
    t.value_usd,
    t.direction, 'on-chain', t.chain_id::text
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
WHERE (b.total_inflow_amount - b.total_outflow_amount) > 0.000001;
