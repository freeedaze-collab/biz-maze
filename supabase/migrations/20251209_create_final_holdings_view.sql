-- v_holdings FINAL v4: Excludes 'internal_transfer' from calculations

DROP VIEW IF EXISTS public.v_holdings;

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
        -- 総流入量：'buy' と 'in' のみを合計
        SUM(CASE WHEN type = 'buy' OR type = 'in' THEN amount ELSE 0 END) AS total_inflow,
        -- 総流出量：'sell' と 'out' のみを合計
        SUM(CASE WHEN type = 'sell' OR type = 'out' THEN amount ELSE 0 END) AS total_outflow,
        -- 累計購入コスト
        SUM(CASE WHEN type = 'buy' THEN acquisition_price_total ELSE 0 END) AS total_buy_cost_ever,
        -- 累計購入量
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_buy_amount_ever
    FROM
        public.v_all_transactions
    -- ★★★★★ ここが重要：内部送金は計算から除外 ★★★★★
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
    CASE
        WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever)
        ELSE 0
    END AS average_buy_price,
    (t.total_inflow - t.total_outflow) * (
        CASE
            WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever)
            ELSE 0
        END
    ) AS cost_of_current_holdings,
    p.price_jpy AS current_price,
    ( (t.total_inflow - t.total_outflow) * p.price_jpy ) -
    (
        (t.total_inflow - t.total_outflow) * (
            CASE
                WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever)
                ELSE 0
            END
        )
    ) AS unrealized_pnl
FROM
    transactions_summary t
LEFT JOIN current_prices p ON t.asset = p.asset
WHERE
    (t.total_inflow - t.total_outflow) > 1e-9;
