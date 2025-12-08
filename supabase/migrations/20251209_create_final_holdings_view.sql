-- v_holdings FINAL: Static Prices and Unrealized PnL
-- NOTE: This version uses hardcoded JPY prices for BTC and ETH as requested.

DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: Aggregate all transactions from the definitive source
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
),
-- Step 2: Define a temporary, static table for current asset prices in JPY
current_prices (asset, price_jpy) AS (
  VALUES
    ('BTC', 10000000),
    ('ETH', 500000)
)
-- Step 3: Calculate final metrics and join with prices to add new columns
SELECT
    a.user_id,
    a.asset,
    -- (保有量)
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) AS current_amount,
    -- (1資産あたりの平均取得価格)
    (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END) AS average_buy_price,
    -- (保有資産の取得総額)
    ((a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) *
     (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END)) AS total_cost,
    -- (確定済みの売却損益)
    (a.total_sell_proceeds - (CASE WHEN a.total_bought_amount > 0 THEN (a.total_buy_cost / a.total_bought_amount) * a.total_sold_amount ELSE 0 END)) AS realized_pnl,
    -- (現在の単価)
    p.price_jpy AS current_price,
    -- (評価損益)
    ( (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) * p.price_jpy ) -
    ( (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) *
      (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END)
    ) AS unrealized_pnl
FROM
    aggregated_transactions a
LEFT JOIN current_prices p ON a.asset = p.asset
WHERE
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) > 1e-9;
