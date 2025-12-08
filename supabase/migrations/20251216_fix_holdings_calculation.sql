-- supabase/migrations/20251216_fix_holdings_calculation.sql
-- PURPOSE: Add current market value to holdings and fix floating point inaccuracies.

-- Drop the existing view to redefine it.
DROP VIEW IF EXISTS public.v_holdings CASCADE;

-- =================================================================
-- TABLE: asset_prices
-- PURPOSE: Store real-time prices for assets. This table needs to be
--          populated by an external service (e.g., a cron job).
-- =================================================================
CREATE TABLE IF NOT EXISTS public.asset_prices (
    asset TEXT PRIMARY KEY,
    current_price NUMERIC NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- Insert some dummy data for demonstration purposes.
INSERT INTO public.asset_prices (asset, current_price)
VALUES
    ('ETH', 3500.00),
    ('BTC', 68000.00)
ON CONFLICT (asset) DO UPDATE SET
    current_price = EXCLUDED.current_price,
    last_updated = now();


-- =================================================================
-- VIEW: v_holdings (Updated)
-- PURPOSE: Calculates holdings, average cost, and now current value.
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS

WITH relevant_transactions AS (
    -- Step 1: Filter out internal transfers.
    SELECT * FROM public.v_all_transactions_classified
    WHERE transaction_type <> 'INTERNAL_TRANSFER'
),
cumulative_transactions AS (
    -- Step 2: Calculate cumulative amounts for buys and sells.
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
    -- Step 3: Determine the final state for each asset.
    SELECT DISTINCT ON (user_id, asset)
        user_id,
        asset,
        LAST_VALUE(cumulative_buy_amount) OVER (PARTITION BY user_id, asset ORDER BY date, id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as total_buy_amount,
        LAST_VALUE(cumulative_buy_cost) OVER (PARTITION BY user_id, asset ORDER BY date, id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as total_buy_cost,
        LAST_VALUE(cumulative_sell_amount) OVER (PARTITION BY user_id, asset ORDER BY date, id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as total_sell_amount
    FROM
        cumulative_transactions
)

-- Step 4: Aggregate, join with prices, and calculate the final metrics.
SELECT
    f.user_id,
    f.asset,
    -- Current Amount = Total Buys - Total Sells
    (f.total_buy_amount - f.total_sell_amount) as current_amount,

    -- ★ NEW: Current market price from the dedicated prices table.
    ap.current_price,

    -- ★ NEW: Current market value of the holdings, rounded to 2 decimal places.
    ROUND(((f.total_buy_amount - f.total_sell_amount) * ap.current_price), 2) AS current_value,

    -- ★ FIXED: Average Buy Price, rounded to 2 decimal places.
    ROUND(
        (CASE
            WHEN f.total_buy_amount > 0 THEN f.total_buy_cost / f.total_buy_amount
            ELSE 0
        END),
        2
    ) as average_buy_price,

    -- ★ FIXED: Total acquisition cost, rounded to 2 decimal places to fix precision issues.
    ROUND(f.total_buy_cost, 2) as total_cost
FROM
    final_holdings f
LEFT JOIN
    -- Join with our new prices table to get the live price for each asset.
    public.asset_prices ap ON f.asset = ap.asset
WHERE
    -- Use a small threshold to avoid floating point issues with zero.
    (f.total_buy_amount - f.total_sell_amount) > 1e-9;
