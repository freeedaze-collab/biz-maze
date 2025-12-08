-- supabase/migrations/20251209_create_final_holdings_view.sql
-- PURPOSE: Creates a self-contained view to calculate capital gains, avoiding dependency issues.

-- Drop the existing v_holdings view to replace it
DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: Define all transactions in a CTE to ensure this view is self-contained.
-- This avoids any dependency on other views that might be out of sync during migration.
all_transactions_cte AS (
    -- On-chain Transactions from wallet_transactions
    SELECT
        t.user_id,
        t.direction AS type, -- 'IN' or 'OUT'
        (t.value_wei / 1e18) AS amount,
        COALESCE(t.asset_symbol, 'ETH') AS asset, -- Base asset
        NULL AS quote_asset, -- No quote asset for on-chain tx
        NULL AS price
    FROM
        public.wallet_transactions t

    UNION ALL

    -- Exchange Trades from exchange_trades
    SELECT
        et.user_id,
        et.side AS type, -- 'buy' or 'sell'
        et.amount,
        split_part(et.symbol, '/', 1) AS asset,      -- Base asset (e.g., BTC)
        split_part(et.symbol, '/', 2) AS quote_asset, -- Quote asset (e.g., USD)
        et.price
    FROM
        public.exchange_trades et
),

-- Step 2: Aggregate transactions to get buy/sell/deposit/withdrawal totals
aggregated_transactions AS (
    SELECT
        user_id,
        asset,
        MAX(quote_asset) AS quote_currency,
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_bought_amount,
        SUM(CASE WHEN type = 'buy' THEN price * amount ELSE 0 END) AS total_buy_cost,
        SUM(CASE WHEN type = 'sell' THEN amount ELSE 0 END) AS total_sold_amount,
        SUM(CASE WHEN type = 'sell' THEN price * amount ELSE 0 END) AS total_sell_proceeds,
        SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END) AS total_deposited,
        SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END) AS total_withdrawn
    FROM
        all_transactions_cte -- Use the self-contained CTE defined above
    GROUP BY
        user_id, asset
)

-- Step 3: Calculate final holdings, cost basis, and realized P&L
SELECT
    a.user_id,
    a.asset AS "資産名",
    a.quote_currency,
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) AS "保有量",
    (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END) AS "平均取得単価",
    ((a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) *
     (CASE WHEN a.total_bought_amount > 0 THEN a.total_buy_cost / a.total_bought_amount ELSE 0 END)) AS "総取得価格",
    (a.total_sell_proceeds - (CASE WHEN a.total_bought_amount > 0 THEN (a.total_buy_cost / a.total_bought_amount) * a.total_sold_amount ELSE 0 END)) AS "実現キャピタルゲイン",
    NULL AS "保有資産の時価総額"
FROM
    aggregated_transactions a
WHERE
    (a.total_bought_amount + a.total_deposited - a.total_sold_amount - a.total_withdrawn) > 1e-9;
