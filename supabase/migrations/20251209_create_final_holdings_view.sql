-- v_holdings FINAL v3: Clarifying "Total Investment" vs "Cost of Holdings"
-- お客様のご指摘を反映し、「総投資額」と「保有資産の取得原価」を明確に分けて表示します。

DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: 静的な現在価格リスト
current_prices (asset, price_jpy) AS (
  VALUES
    ('BTC', 10000000),
    ('ETH', 500000)
),
-- Step 2: 全ての取引を集計
transactions_summary AS (
    SELECT
        user_id,
        asset,
        -- 総流入量（購入＋入金）
        SUM(CASE WHEN type = 'buy' OR type = 'IN' THEN amount ELSE 0 END) AS total_inflow,
        -- 総流出量（売却＋出金）
        SUM(CASE WHEN type = 'sell' OR type = 'OUT' THEN amount ELSE 0 END) AS total_outflow,
        -- これまでの累計購入コスト（お客様ご指摘の acquisition_price_total の合計）
        SUM(CASE WHEN type = 'buy' THEN acquisition_price_total ELSE 0 END) AS total_buy_cost_ever,
        -- これまでの累計購入量
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_buy_amount_ever
    FROM
        public.v_all_transactions
    GROUP BY
        user_id, asset
)
-- Step 3: 最終的な指標を算出
SELECT
    t.user_id,
    t.asset,

    --【列1】保有量 (current_amount)
    -- 計算式: 総流入量 - 総流出量
    (t.total_inflow - t.total_outflow) AS current_amount,

    --【列2】お客様が見たい「総投資額」 (total_investment)
    -- 計算式: acquisition_price_total の資産ごと合計
    t.total_buy_cost_ever AS total_investment,

    --【列3】平均取得単価 (average_buy_price)
    -- 計算式: 累計購入コスト ÷ 累計購入量
    CASE
        WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever)
        ELSE 0
    END AS average_buy_price,

    --【列4】保有資産の取得原価 (cost_of_current_holdings)
    -- 損益計算の基礎となる、会計上の取得原価
    -- 計算式: 現在の保有量 × 平均取得単価
    (t.total_inflow - t.total_outflow) * (
        CASE
            WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever)
            ELSE 0
        END
    ) AS cost_of_current_holdings,

    --【列5】現在価格 (current_price)
    p.price_jpy AS current_price,

    --【列6】評価損益 (unrealized_pnl)
    -- 計算式: (保有量 × 現在価格) - 保有資産の取得原価
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
    -- 保有量がゼロより大きい資産のみ表示
    (t.total_inflow - t.total_outflow) > 1e-9;
