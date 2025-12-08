-- supabase/migrations/20251216_fix_holdings_calculation.sql
-- PURPOSE: Add current market value, fix visibility, and handle floating point inaccuracies.

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

-- Insert some dummy data for demonstration. This won't fail if they exist.
INSERT INTO public.asset_prices (asset, current_price)
VALUES
    ('ETH', 3500.00),
    ('BTC', 68000.00)
ON CONFLICT (asset) DO UPDATE SET
    current_price = EXCLUDED.current_price,
    last_updated = now();

-- =================================================================
-- VIEW: v_holdings (Corrected and Enhanced)
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS

WITH relevant_transactions AS (
    -- Step 1: Filter out internal transfers.
    SELECT * FROM public.v_all_transactions_classified
    WHERE transaction_type <> 'INTERNAL_TRANSFER'
),
cumulative_transactions AS (
    -- Step 2: Calculate cumulative amounts. Using `id` for a stable sort order.
    SELECT
        *,
        SUM(CASE WHEN transaction_type = 'BUY' THEN amount ELSE 0 END)
            OVER (PARTITION BY user_id, asset ORDER BY date, id) as cumulative_buy_amount,
        SUM(CASE WHEN transaction_type = 'BUY' THEN amount * price ELSE 0 END)
            OVER (PARTITION BY user_id, asset ORDER BY date, id) as cumulative_buy_cost,
        SUM(CASE WHEN transaction_type = 'SELL' THEN amount ELSE 0 END)
            OVER (PARTITION BY user_id, asset ORDER BY date, id) as cumulative_sell_amount
    FROM
        relevant_transactions
),
final_holdings AS (
    -- Step 3: Get the final cumulative values for each transaction row.
    SELECT
        user_id,
        asset,
        LAST_VALUE(cumulative_buy_amount) OVER (PARTITION BY user_id, asset ORDER BY date, id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as total_buy_amount,
        LAST_VALUE(cumulative_buy_cost) OVER (PARTITION BY user_id, asset ORDER BY date, id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as total_buy_cost,
        LAST_VALUE(cumulative_sell_amount) OVER (PARTITION BY user_id, asset ORDER BY date, id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as total_sell_amount
    FROM
        cumulative_transactions
)

-- Step 4: Aggregate to one row per asset, join with prices, and calculate final metrics.
SELECT DISTINCT
    f.user_id,
    f.asset,
    -- Current Amount
    (f.total_buy_amount - f.total_sell_amount) as current_amount,

    -- ★ NEW & FIXED: Current market price. Shows 0 if no price is available.
    COALESCE(ap.current_price, 0) as current_price,

    -- ★ NEW & FIXED: Current market value. Shows 0 if no price is available.
    ROUND(
        (f.total_buy_amount - f.total_sell_amount) * COALESCE(ap.current_price, 0),
        2
    ) AS current_value,

    -- ★ FIXED: Average Buy Price, rounded.
    ROUND(
        (CASE
            WHEN f.total_buy_amount > 0 THEN f.total_buy_cost / f.total_buy_amount
            ELSE 0
        END),
        2
    ) as average_buy_price,

    -- ★ FIXED: Total acquisition cost, rounded.
    ROUND(f.total_buy_cost, 2) as total_cost
FROM
    final_holdings f
-- ★ FIXED: LEFT JOIN now correctly includes all holdings, even without a price.
LEFT JOIN
    public.asset_prices ap ON f.asset = ap.asset
WHERE
    -- Use a small threshold to avoid floating point issues with zero balances.
    (f.total_buy_amount - f.total_sell_amount) > 1e-9;
