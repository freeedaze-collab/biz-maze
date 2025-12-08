-- supabase/migrations/20251209_create_final_holdings_view.sql
-- PURPOSE: Creates a view to calculate capital gains based on transaction history.

-- Drop the existing v_holdings view to replace it
DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: Aggregate transactions to get buy/sell/deposit/withdrawal totals
aggregated_transactions AS (
    SELECT
        user_id,
        asset,
        -- We need a single quote currency for calculations. MAX is a deterministic way to pick one if multiple exist.
        MAX(quote_asset) AS quote_currency,

        -- Sums for buys from exchanges
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_bought_amount,
        SUM(CASE WHEN type = 'buy' THEN price * amount ELSE 0 END) AS total_buy_cost,

        -- Sums for sells from exchanges
        SUM(CASE WHEN type = 'sell' THEN amount ELSE 0 END) AS total_sold_amount,
        SUM(CASE WHEN type = 'sell' THEN price * amount ELSE 0 END) AS total_sell_proceeds,

        -- Sums for on-chain transfers
        SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END) AS total_deposited,
        SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END) AS total_withdrawn
    FROM
        public.all_transactions
    GROUP BY
        user_id, asset
)

-- Step 2: Calculate holdings, cost basis, and realized P&L
SELECT
    a.user_id,
    a.asset AS "資産名",
    a.quote_currency,

    -- Current amount of the asset held
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) AS "保有量",

    -- Average cost per unit for all assets ever bought on exchanges.
    (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END) AS "平均取得単価",

    -- Total acquisition cost (cost basis) for the current holdings.
    ((a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) *
     (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END)) AS "総取得価格",

    -- Realized Profit or Loss from sales.
    (a.total_sell_proceeds - (CASE WHEN a.total_bought_amount > 0 THEN (a.total_buy_cost / a.total_bought_amount) * a.total_sold_amount ELSE 0 END)) AS "実現キャピタルゲイン",

    -- I cannot calculate "保有資産の総価格" (Total value of held assets) because I don't have a live price feed.
    -- This column is a placeholder.
    NULL AS "保有資産の時価総額"

FROM
    aggregated_transactions a
WHERE
    -- Filter out assets with negligible amounts (dust).
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) > 1e-9;
