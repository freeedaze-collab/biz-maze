-- supabase/migrations/20251216_fix_holdings_calculation.sql
-- PURPOSE: Final, definitive fix for holdings calculation.
-- This version correctly handles all transaction types, removes destructive filtering,
-- and adds the requested realized capital gain/loss column.

-- Drop the existing view to ensure a clean re-creation of the schema.
DROP VIEW IF EXISTS public.v_holdings CASCADE;

-- =================================================================
-- TABLE: asset_prices (Ensures it exists)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.asset_prices (
    asset TEXT PRIMARY KEY,
    current_price NUMERIC NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- Insert/update dummy data for demonstration.
INSERT INTO public.asset_prices (asset, current_price)
VALUES
    ('ETH', 3500.00),
    ('BTC', 68000.00)
ON CONFLICT (asset) DO UPDATE SET
    current_price = EXCLUDED.current_price,
    last_updated = now();

-- =================================================================
-- VIEW: v_holdings (Definitive, Corrected, and Enhanced Version)
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS

WITH base_calcs AS (
    -- Step 1: Aggregate all inflows, outflows, costs, and proceeds from the base transactions view.
    SELECT
        user_id,
        asset,

        -- ★ FIX: Inflows now include all relevant types (buy, receive, deposit, in).
        SUM(CASE WHEN type ILIKE 'buy' OR type ILIKE 'receive' OR type ILIKE 'deposit%' OR type ILIKE 'in' THEN amount ELSE 0 END) as total_inflow_amount,

        -- ★ FIX: Outflows now include all relevant types (sell, send, withdraw, out).
        SUM(CASE WHEN type ILIKE 'sell' OR type ILIKE 'send' OR type ILIKE 'withdraw%' OR type ILIKE 'out' THEN amount ELSE 0 END) as total_outflow_amount,

        -- Cost basis calculations (from BUYs only).
        SUM(CASE WHEN type ILIKE 'buy' THEN amount * price ELSE 0 END) as total_buy_cost,
        SUM(CASE WHEN type ILIKE 'buy' THEN amount ELSE 0 END) as total_buy_quantity,

        -- ★ NEW: Sell proceeds and quantity for capital gain calculation.
        SUM(CASE WHEN type ILIKE 'sell' THEN amount * price ELSE 0 END) as total_sell_proceeds,
        SUM(CASE WHEN type ILIKE 'sell' THEN amount ELSE 0 END) as total_sell_quantity

    FROM
        public.all_transactions
    GROUP BY
        user_id,
        asset
)

-- Step 2: Join with prices and calculate all final metrics.
SELECT
    b.user_id,
    b.asset,
    -- Final Current Amount (can now be negative if more was sold than bought).
    (b.total_inflow_amount - b.total_outflow_amount) as current_amount,

    -- Current market price (defaults to 0 if not available).
    COALESCE(ap.current_price, 0) as current_price,

    -- Current market value.
    ROUND(
        (b.total_inflow_amount - b.total_outflow_amount) * COALESCE(ap.current_price, 0),
        2
    ) AS current_value,

    -- Average Buy Price (cost per unit bought).
    ROUND(
        (CASE WHEN b.total_buy_quantity > 0 THEN b.total_buy_cost / b.total_buy_quantity ELSE 0 END),
        2
    ) as average_buy_price,

    -- Total acquisition cost (total spent on buys).
    ROUND(b.total_buy_cost, 2) as total_cost,

    -- ★ NEW: Realized Capital Gain/Loss.
    ROUND(
        b.total_sell_proceeds - (b.total_sell_quantity * (CASE WHEN b.total_buy_quantity > 0 THEN b.total_buy_cost / b.total_buy_quantity ELSE 0 END)),
        2
    ) as realized_capital_gain_loss
FROM
    base_calcs b
LEFT JOIN
    public.asset_prices ap ON b.asset = ap.asset;
-- ★ CRUCIAL FIX: The WHERE clause that was filtering out BTC has been completely removed.
