-- supabase/migrations/20251216_fix_holdings_calculation.sql
-- PURPOSE: Final consolidated fix. This single file rebuilds the entire view chain correctly.
-- It re-creates all_transactions with the correct SELL logic, restores dependent views,
-- and creates the final, correct version of v_holdings.

-- Step 1: Drop potentially outdated views in reverse order of dependency.
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- =================================================================
-- VIEW: all_transactions (Corrected version)
-- Re-created with the crucial fix for SELL trade amount calculation.
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions AS
-- On-chain Transactions
SELECT
    t.id::text, t.user_id, t.tx_hash AS reference_id, t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount, COALESCE(t.asset_symbol, 'ETH') AS asset, NULL AS quote_asset, NULL AS price,
    t.direction AS type, 'on-chain' as source, t.chain_id::text AS chain, t.wallet_address, NULL::text AS connection_name
FROM public.wallet_transactions t
UNION ALL
-- Exchange Trades (with corrected amount logic)
SELECT
    et.trade_id::text, et.user_id, et.trade_id::text, et.ts,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text,
    CASE
        WHEN et.side = 'buy' THEN et.amount
        WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price
        ELSE 0
    END AS amount,
    split_part(et.symbol, '/', 1), split_part(et.symbol, '/', 2), et.price, et.side, 'exchange', et.exchange,
    NULL::text, ec.connection_name
FROM public.exchange_trades et
LEFT JOIN public.exchange_connections ec ON et.exchange_connection_id = ec.id;

-- =================================================================
-- VIEW: internal_transfer_pairs (Restored)
-- This view is restored to ensure no other part of the system breaks.
-- =================================================================
CREATE OR REPLACE VIEW public.internal_transfer_pairs AS
SELECT
    tx_out.user_id, tx_out.id AS withdrawal_id, tx_in.id AS deposit_id
FROM public.all_transactions tx_out
JOIN public.all_transactions tx_in ON tx_out.user_id = tx_in.user_id
    AND tx_out.asset = tx_in.asset
    AND (tx_out.type ILIKE 'withdraw%' OR tx_out.type = 'send')
    AND (tx_in.type ILIKE 'deposit%' OR tx_in.type = 'receive')
    AND tx_in.amount BETWEEN (tx_out.amount * 0.999) AND tx_out.amount
    AND tx_in.date > tx_out.date AND tx_in.date <= (tx_out.date + INTERVAL '12 hours')
    AND COALESCE(tx_out.connection_name, tx_out.wallet_address) <> COALESCE(tx_in.connection_name, tx_in.wallet_address);

-- =================================================================
-- VIEW: v_all_transactions_classified (Restored)
-- This view is also restored for system integrity.
-- =================================================================
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
WITH all_internal_ids AS (
    SELECT withdrawal_id AS id FROM public.internal_transfer_pairs
    UNION SELECT deposit_id AS id FROM public.internal_transfer_pairs
)
SELECT
    t.*,
    CASE
        WHEN ai.id IS NOT NULL THEN 'INTERNAL_TRANSFER'
        WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
        WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' THEN 'DEPOSIT'
        WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' THEN 'WITHDRAWAL'
        ELSE 'OTHER'
    END as transaction_type
FROM public.all_transactions t
LEFT JOIN all_internal_ids ai ON t.id = ai.id;

-- =================================================================
-- TABLE: asset_prices (Ensures it exists)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.asset_prices (asset TEXT PRIMARY KEY, current_price NUMERIC NOT NULL, last_updated TIMESTAMPTZ DEFAULT now());
INSERT INTO public.asset_prices (asset, current_price) VALUES ('ETH', 3500.00), ('BTC', 68000.00) ON CONFLICT (asset) DO UPDATE SET current_price = EXCLUDED.current_price, last_updated = now();

-- =================================================================
-- VIEW: v_holdings (Final and Correct Version)
-- The definitive view with all fixes and enhancements applied.
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS
WITH base_calcs AS (
    SELECT
        user_id, asset,
        SUM(CASE WHEN type ILIKE 'buy' OR type ILIKE 'receive' OR type ILIKE 'deposit%' OR type ILIKE 'in' THEN amount ELSE 0 END) as total_inflow_amount,
        SUM(CASE WHEN type ILIKE 'sell' OR type ILIKE 'send' OR type ILIKE 'withdraw%' OR type ILIKE 'out' THEN amount ELSE 0 END) as total_outflow_amount,
        SUM(CASE WHEN type ILIKE 'buy' THEN amount * price ELSE 0 END) as total_buy_cost,
        SUM(CASE WHEN type ILIKE 'buy' THEN amount ELSE 0 END) as total_buy_quantity,
        SUM(CASE WHEN type ILIKE 'sell' THEN amount * price ELSE 0 END) as total_sell_proceeds,
        SUM(CASE WHEN type ILIKE 'sell' THEN amount ELSE 0 END) as total_sell_quantity
    FROM public.all_transactions GROUP BY user_id, asset
)
SELECT
    b.user_id, b.asset,
    (b.total_inflow_amount - b.total_outflow_amount) as current_amount,
    COALESCE(ap.current_price, 0) as current_price,
    ROUND((b.total_inflow_amount - b.total_outflow_amount) * COALESCE(ap.current_price, 0), 2) AS current_value,
    ROUND((CASE WHEN b.total_buy_quantity > 0 THEN b.total_buy_cost / b.total_buy_quantity ELSE 0 END), 2) as average_buy_price,
    ROUND(b.total_buy_cost, 2) as total_cost,
    ROUND(b.total_sell_proceeds - (b.total_sell_quantity * (CASE WHEN b.total_buy_quantity > 0 THEN b.total_buy_cost / b.total_buy_quantity ELSE 0 END)), 2) as realized_capital_gain_loss
FROM base_calcs b
LEFT JOIN public.asset_prices ap ON b.asset = ap.asset;
