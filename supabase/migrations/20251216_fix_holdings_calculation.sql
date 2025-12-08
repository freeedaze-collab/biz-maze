-- supabase/migrations/20251216_fix_holdings_calculation.sql
-- PURPOSE: Add current market value, fix visibility, and handle inaccuracies with a simpler, more robust query.

-- Drop the existing view to redefine it.
DROP VIEW IF EXISTS public.v_holdings CASCADE;

-- =================================================================
-- TABLE: asset_prices (Ensures it exists)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.asset_prices (
    asset TEXT PRIMARY KEY,
    current_price NUMERIC NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- Insert dummy data for demonstration. This won't fail if assets already exist.
INSERT INTO public.asset_prices (asset, current_price)
VALUES
    ('ETH', 3500.00),
    ('BTC', 68000.00)
ON CONFLICT (asset) DO UPDATE SET
    current_price = EXCLUDED.current_price,
    last_updated = now();

-- =================================================================
-- VIEW: v_holdings (Simplified and Corrected)
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS

WITH holdings_by_asset AS (
    -- Step 1: Calculate total buys and sells for each asset using a simple GROUP BY.
    -- This is much more robust than the previous window function approach.
    SELECT
        user_id,
        asset,
        SUM(CASE WHEN transaction_type = 'BUY' THEN amount ELSE 0 END) as total_buy_amount,
        SUM(CASE WHEN transaction_type = 'BUY' THEN amount * price ELSE 0 END) as total_buy_cost,
        SUM(CASE WHEN transaction_type = 'SELL' THEN amount ELSE 0 END) as total_sell_amount
    FROM
        public.v_all_transactions_classified
    WHERE
        -- Internal transfers are excluded from the calculation.
        transaction_type <> 'INTERNAL_TRANSFER'
    GROUP BY
        user_id,
        asset
)

-- Step 2: Join with prices and calculate final metrics for all assets with a non-zero balance.
SELECT
    h.user_id,
    h.asset,
    -- Final Current Amount
    (h.total_buy_amount - h.total_sell_amount) as current_amount,

    -- Current market price (defaults to 0 if not in the price table)
    COALESCE(ap.current_price, 0) as current_price,

    -- Current market value (defaults to 0 if no price is available)
    ROUND(
        (h.total_buy_amount - h.total_sell_amount) * COALESCE(ap.current_price, 0),
        2
    ) AS current_value,

    -- Average Buy Price, rounded to 2 decimal places.
    ROUND(
        (CASE
            WHEN h.total_buy_amount > 0 THEN h.total_buy_cost / h.total_buy_amount
            ELSE 0
        END),
        2
    ) as average_buy_price,

    -- Total acquisition cost, rounded to 2 decimal places.
    ROUND(h.total_buy_cost, 2) as total_cost
FROM
    holdings_by_asset h
LEFT JOIN
    public.asset_prices ap ON h.asset = ap.asset
WHERE
    -- Filter out assets where the final balance is zero or negligible.
    (h.total_buy_amount - h.total_sell_amount) > 1e-9;
