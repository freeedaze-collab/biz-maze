-- supabase/migrations/20251209_create_final_holdings_view.sql
-- PURPOSE: Creates the final holdings view with column names matching the frontend component.

DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
aggregated_transactions AS (
    SELECT
        user_id,
        asset,
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_bought_amount,
        SUM(CASE WHEN type = 'buy' THEN acquisition_price_total ELSE 0 END) AS total_buy_cost,
        SUM(CASE WHEN type = 'sell' THEN amount ELSE 0 END) AS total_sold_amount,
        SUM(CASE WHEN type = 'sell' THEN acquisition_price_total ELSE 0 END) AS total_sell_proceeds,
        SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END) AS total_deposited,
        SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END) AS total_withdrawn
    FROM
        public.v_all_transactions
    GROUP BY
        user_id, asset
)
SELECT
    a.user_id,
    a.asset, -- Front-end expects 'asset'
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) AS current_amount,
    (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END) AS average_buy_price,
    ((a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) *
     (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END)) AS total_cost,
    (a.total_sell_proceeds - (CASE WHEN a.total_bought_amount > 0 THEN (a.total_buy_cost / a.total_bought_amount) * a.total_sold_amount ELSE 0 END)) AS realized_pnl,
    NULL AS current_price
FROM
    aggregated_transactions a
WHERE
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) > 1e-9;
