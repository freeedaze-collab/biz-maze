-- v_holdings FINAL v4: Excludes 'internal_transfer' from calculations

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: 静的な現在価格リスト
current_prices (asset, price_jpy) AS (
  VALUES
    ('BTC', 10000000),
    ('ETH', 500000)
),
-- Step 2: 全ての取引を集計（ただし internal_transfer は無視する）
transactions_summary AS (
    SELECT
        user_id,
        asset,
        SUM(CASE WHEN type = 'buy' OR type = 'in' THEN amount ELSE 0 END) AS total_inflow,
        SUM(CASE WHEN type = 'sell' OR type = 'out' THEN amount ELSE 0 END) AS total_outflow,
        SUM(CASE WHEN type = 'buy' THEN acquisition_price_total ELSE 0 END) AS total_buy_cost_ever,
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_buy_amount_ever
    FROM
        public.v_all_transactions
    WHERE type != 'internal_transfer'
    GROUP BY
        user_id, asset
)
-- Step 3: 最終的な指標を算出
SELECT
    t.user_id,
    t.asset,
    (t.total_inflow - t.total_outflow) AS current_amount,
    t.total_buy_cost_ever AS total_investment,
    CASE WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever) ELSE 0 END AS average_buy_price,
    (t.total_inflow - t.total_outflow) * (CASE WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever) ELSE 0 END) AS cost_of_current_holdings,
    p.price_jpy AS current_price,
    ( (t.total_inflow - t.total_outflow) * p.price_jpy ) -
    ( (t.total_inflow - t.total_outflow) * (CASE WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever) ELSE 0 END) ) AS unrealized_pnl
FROM
    transactions_summary t
LEFT JOIN current_prices p ON t.asset = p.asset
WHERE
    (t.total_inflow - t.total_outflow) > 1e-9;
