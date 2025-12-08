-- supabase/migrations/20251216_fix_holdings_calculation.sql
-- PURPOSE: Final, definitive fix for holdings calculation.
-- This version bypasses the complex classification logic and computes holdings
-- directly from the base transaction view, ensuring all assets are correctly included.

-- Drop the existing view to redefine it from a stable base.
DROP VIEW IF EXISTS public.v_holdings CASCADE;

-- =================================================================
-- TABLE: asset_prices (Ensures it exists)
-- This part remains the same.
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
-- VIEW: v_holdings (Definitive, Simplified Version)
-- This version directly uses `public.all_transactions` and correctly
-- categorizes inflows/outflows, bypassing the buggy internal transfer logic.
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS

WITH base_calcs AS (
    -- Step 1: Aggregate all inflows and outflows directly from the base transactions view.
    -- This avoids the buggy `v_all_transactions_classified` view entirely.
    SELECT
        user_id,
        asset,

        -- ★ FIX: Inflows are BUYs from exchanges and RECEIVEs/DEPOSITs on-chain.
        SUM(CASE WHEN type ILIKE 'buy' OR type ILIKE 'receive' OR type ILIKE 'deposit%' THEN amount ELSE 0 END) as total_inflow_amount,

        -- ★ FIX: Outflows are SELLs from exchanges and SENDs/WITHDRAWALs on-chain.
        SUM(CASE WHEN type ILIKE 'sell' OR type ILIKE 'send' OR type ILIKE 'withdraw%' THEN amount ELSE 0 END) as total_outflow_amount,

        -- Cost calculations remain based only on actual BUY transactions with a price.
        SUM(CASE WHEN type = 'buy' THEN amount * price ELSE 0 END) as total_buy_cost,
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) as total_buy_quantity
    FROM
        -- ★ CRUCIAL FIX: Use the stable, pre-classification view.
        public.all_transactions
    GROUP BY
        user_id,
        asset
)
-- Step 2: Join with prices and calculate the final metrics.
SELECT
    b.user_id,
    b.asset,
    -- Final Current Amount = Total Inflows - Total Outflows
    (b.total_inflow_amount - b.total_outflow_amount) as current_amount,

    -- Current market price (defaults to 0 if not in the price table)
    COALESCE(ap.current_price, 0) as current_price,

    -- Current market value
    ROUND(
        (b.total_inflow_amount - b.total_outflow_amount) * COALESCE(ap.current_price, 0),
        2
    ) AS current_value,

    -- Average Buy Price (based only on BUY transactions), rounded.
    ROUND(
        (CASE
            WHEN b.total_buy_quantity > 0 THEN b.total_buy_cost / b.total_buy_quantity
            ELSE 0
        END),
        2
    ) as average_buy_price,

    -- Total acquisition cost (from BUYs), rounded.
    ROUND(b.total_buy_cost, 2) as total_cost
FROM
    base_calcs b
LEFT JOIN
    public.asset_prices ap ON b.asset = ap.asset
WHERE
    -- Filter out assets where the final balance is zero or negligible.
    (b.total_inflow_amount - b.total_outflow_amount) > 1e-9;
