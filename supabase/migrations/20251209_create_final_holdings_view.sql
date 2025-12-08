-- supabase/migrations/20251209_create_final_holdings_view.sql
-- PURPOSE: Creates the final holdings view, deriving all data from v_all_transactions.

-- Drop the existing view to ensure a clean replacement with the updated logic
DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: Aggregate transactions directly from the canonical v_all_transactions view
aggregated_transactions AS (
    SELECT
        user_id,
        asset,
        MAX(quote_asset) AS quote_currency,
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_bought_amount,
        SUM(CASE WHEN type = 'buy' THEN acquisition_price_total ELSE 0 END) AS total_buy_cost,
        SUM(CASE WHEN type = 'sell' THEN amount ELSE 0 END) AS total_sold_amount,
        SUM(CASE WHEN type = 'sell' THEN acquisition_price_total ELSE 0 END) AS total_sell_proceeds,
        SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END) AS total_deposited,
        SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END) AS total_withdrawn
    FROM
        public.v_all_transactions -- This view is now the single source of truth
    GROUP BY
        user_id, asset
)

-- Step 2: Calculate final holdings, cost basis, and realized P&L from the aggregated data
SELECT
    a.user_id,
    a.asset AS "資産名",
    a.quote_currency,
    -- 保有量 (Current Holdings)
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) AS "保有量",
    -- 平均取得単価 (Average Acquisition Price)
    (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END) AS "平均取得単価",
    -- 総取得価格 (Total Acquisition Cost of Current Holdings)
    ((a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) *
     (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END)) AS "総取得価格",
    -- 実現キャピタルゲイン (Realized Capital Gains)
    (a.total_sell_proceeds - (CASE WHEN a.total_bought_amount > 0 THEN (a.total_buy_cost / a.total_bought_amount) * a.total_sold_amount ELSE 0 END)) AS "実現キャピタルゲイン",
    -- 保有資産の時価総額 (Market Value of Holdings) - Placeholder
    NULL AS "保有資産の時価総額"
FROM
    aggregated_transactions a
WHERE
    -- Filter out assets with zero or negligible holdings
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) > 1e-9;
