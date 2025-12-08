-- supabase/migrations/20251209_create_final_holdings_view.sql
-- PURPOSE: Creates the final holdings view based on user requirements, deriving all data from v_all_transactions.

-- Drop the existing view to ensure a clean replacement with the updated logic
DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: Aggregate transactions from the single source of truth, v_all_transactions
aggregated_transactions AS (
    SELECT
        user_id,
        asset,
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_bought_amount,
        SUM(CASE WHEN type = 'buy' THEN acquisition_price_total ELSE 0 END) AS total_buy_cost, -- Total cost for all buys
        SUM(CASE WHEN type = 'sell' THEN amount ELSE 0 END) AS total_sold_amount,
        SUM(CASE WHEN type = 'sell' THEN acquisition_price_total ELSE 0 END) AS total_sell_proceeds, -- Total proceeds from all sells
        SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END) AS total_deposited,
        SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END) AS total_withdrawn
    FROM
        public.v_all_transactions
    GROUP BY
        user_id, asset
)

-- Step 2: Calculate final holdings metrics as specified by the user
SELECT
    a.user_id,
    a.asset AS "保有資産",
    
    -- Current holdings amount
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) AS "保有量",

    -- Total acquisition cost for the assets currently held (using average cost basis)
    ((a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) *
     (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END)) AS "取得総額",

    -- Realized capital gains from sales
    (a.total_sell_proceeds - (CASE WHEN a.total_bought_amount > 0 THEN (a.total_buy_cost / a.total_bought_amount) * a.total_sold_amount ELSE 0 END)) AS "確定キャピタルゲイン分",

    -- Placeholder for the current market value of holdings. Requires an external price feed.
    NULL AS "現在価格"
FROM
    aggregated_transactions a
WHERE
    -- Filter out assets with zero or negligible holdings
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) > 1e-9;
