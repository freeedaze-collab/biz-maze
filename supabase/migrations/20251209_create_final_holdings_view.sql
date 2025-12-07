-- supabase/migrations/20251209_create_final_holdings_view.sql
-- PURPOSE: Creates the definitive v_holdings view directly from source tables to calculate financial summaries.

-- Drop the view if it exists for a clean rebuild
DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: Aggregate all trades from exchanges
exchange_summary AS (
    SELECT
        user_id,
        split_part(symbol, '/', 1) AS asset,

        -- Calculate total buy amounts and costs
        SUM(CASE WHEN side = 'buy' THEN amount ELSE 0 END) AS total_bought_amount,
        SUM(CASE WHEN side = 'buy' THEN price * amount ELSE 0 END) AS total_buy_cost,

        -- Calculate total sell amounts and proceeds
        SUM(CASE WHEN side = 'sell' THEN amount ELSE 0 END) AS total_sold_amount,
        SUM(CASE WHEN side = 'sell' THEN price * amount ELSE 0 END) AS total_sell_proceeds
    FROM
        public.exchange_trades
    GROUP BY
        user_id,
        asset
),

-- Step 2: Aggregate all on-chain deposits and withdrawals
wallet_summary AS (
    SELECT
        user_id,
        COALESCE(asset_symbol, 'ETH') AS asset,
        SUM(
            CASE
                WHEN direction = 'IN' THEN (value_wei / 1e18)
                WHEN direction = 'OUT' THEN -(value_wei / 1e18)
                ELSE 0
            END
        ) AS net_wallet_flow
    FROM
        public.wallet_transactions
    GROUP BY
        user_id,
        asset
),

-- Step 3: Combine exchange and wallet data into a single source of truth
combined_summary AS (
    SELECT
        COALESCE(e.user_id, w.user_id) AS user_id,
        COALESCE(e.asset, w.asset) AS asset,
        COALESCE(e.total_bought_amount, 0) AS total_bought_amount,
        COALESCE(e.total_buy_cost, 0) AS total_buy_cost,
        COALESCE(e.total_sold_amount, 0) AS total_sold_amount,
        COALESCE(e.total_sell_proceeds, 0) AS total_sell_proceeds,
        COALESCE(w.net_wallet_flow, 0) AS net_wallet_flow
    FROM
        exchange_summary e
    FULL OUTER JOIN
        wallet_summary w ON e.user_id = w.user_id AND e.asset = w.asset
)

-- Step 4: Final Calculation of P&L and Holdings using the combined data
SELECT
    user_id,
    asset,

    -- Calculate the average cost per unit for all assets ever bought (using Average Cost Basis method)
    CASE
        WHEN total_bought_amount > 0 THEN total_buy_cost / total_bought_amount
        ELSE 0
    END AS average_buy_price,

    -- REALIZED P&L: The profit or loss from completed sales.
    -- (Total Sell Proceeds) - (Cost of the assets that were sold)
    total_sell_proceeds - ((CASE
        WHEN total_bought_amount > 0 THEN (total_buy_cost / total_bought_amount)
        ELSE 0
    END) * total_sold_amount) AS realized_pnl,

    -- CURRENT HOLDINGS: The amount of asset the user currently has.
    total_bought_amount - total_sold_amount + net_wallet_flow AS current_amount,

    -- COST BASIS: The total cost of the assets currently held.
    (total_bought_amount - total_sold_amount) * (CASE
        WHEN total_bought_amount > 0 THEN total_buy_cost / total_bought_amount
        ELSE 0
    END) AS cost_basis

FROM
    combined_summary;
