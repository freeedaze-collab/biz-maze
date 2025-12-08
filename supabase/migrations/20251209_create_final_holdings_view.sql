-- v_holdings FINAL v2: Simplified & Clarified Logic
-- これまでの複雑な計算をすべて破棄し、ご要望通りシンプルな算数に基づいて再構築します。

DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: ご指定いただいた現在の価格リストを定義
current_prices (asset, price_jpy) AS (
  VALUES
    ('BTC', 10000000),
    ('ETH', 500000)
),

-- Step 2: 全ての取引を「流入」と「流出」に分けて集計
transactions_summary AS (
    SELECT
        user_id,
        asset,
        -- 流入合計：純粋な「購入(buy)」と「入金(IN)」の量を足し算
        SUM(CASE WHEN type = 'buy' OR type = 'IN' THEN amount ELSE 0 END) AS total_inflow,
        -- 流出合計：純粋な「売却(sell)」と「出金(OUT)」の量を足し算
        SUM(CASE WHEN type = 'sell' OR type = 'OUT' THEN amount ELSE 0 END) AS total_outflow,
        -- 総購入コスト：「購入(buy)」に費やした円貨の総額
        SUM(CASE WHEN type = 'buy' THEN acquisition_price_total ELSE 0 END) AS total_buy_cost_ever,
        -- 総購入量：「購入(buy)」で得た暗号資産の総量
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_buy_amount_ever,
        -- 売却による総受取額と総売却量（現在は取引データにないため0になります）
        SUM(CASE WHEN type = 'sell' THEN acquisition_price_total ELSE 0 END) AS total_sell_proceeds_ever,
        SUM(CASE WHEN type = 'sell' THEN amount ELSE 0 END) AS total_sell_amount_ever
    FROM
        public.v_all_transactions
    GROUP BY
        user_id, asset
)

-- Step 3: 最終的な指標を、シンプルな計算式で算出
SELECT
    t.user_id,
    t.asset,

    --【列1】保有量 (current_amount)
    -- 計算式: 総流入量 - 総流出量
    (t.total_inflow - t.total_outflow) AS current_amount,

    --【列2】平均取得単価 (average_buy_price)
    -- 計算式: 総購入コスト ÷ 総購入量
    CASE
        WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever)
        ELSE 0
    END AS average_buy_price,

    --【列3】保有資産の取得総額 (total_cost)
    -- 計算式: 現在の保有量 × 平均取得単価
    (t.total_inflow - t.total_outflow) * (
        CASE
            WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever)
            ELSE 0
        END
    ) AS total_cost,

    --【列4】現在価格 (current_price)
    -- ご指定の固定価格
    p.price_jpy AS current_price,

    --【列5】評価損益 (unrealized_pnl)
    -- 計算式: (現在の保有量 × 現在価格) - (保有資産の取得総額)
    ( (t.total_inflow - t.total_outflow) * p.price_jpy ) -
    (
        (t.total_inflow - t.total_outflow) * (
            CASE
                WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever)
                ELSE 0
            END
        )
    ) AS unrealized_pnl,

    --【列6】確定損益 (realized_pnl)
    -- 計算式: 総売却額 - (売却した量 × 平均取得単価)
    (t.total_sell_proceeds_ever - (t.total_sell_amount_ever * (
        CASE
            WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever)
            ELSE 0
        END
    ))) AS realized_pnl

FROM
    transactions_summary t
LEFT JOIN current_prices p ON t.asset = p.asset
WHERE
    -- 保有量がゼロより大きい資産のみ表示
    (t.total_inflow - t.total_outflow) > 1e-9;
