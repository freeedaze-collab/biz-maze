-- supabase/migrations/20251209_create_final_holdings_view.sql
-- PURPOSE: Creates the definitive v_holdings view with the correct column names and logic.

-- Drop the view if it exists for a clean rebuild
DROP VIEW IF EXISTS public.v_holdings;

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: Union raw transactions from both sources into a common format
all_transactions AS (
    -- Exchange Trades
    SELECT
        user_id,
        split_part(symbol, '/', 1) AS asset,
        split_part(symbol, '/', 2) AS cost_currency, -- Extract cost currency for later
        side,                                        -- 'buy' or 'sell'
        amount,
        price
    FROM public.exchange_trades

    UNION ALL

    -- Wallet Transactions
    SELECT
        user_id,
        COALESCE(asset_symbol, 'ETH') AS asset,
        NULL AS cost_currency, -- On-chain transactions don't have a paired cost currency
        CASE direction WHEN 'IN' THEN 'deposit' ELSE 'withdrawal' END AS side,
        (value_wei / 1e18) AS amount,
        NULL AS price -- On-chain transactions don't have a trade price
    FROM public.wallet_transactions
),

-- Step 2: Aggregate financial metrics for each asset
aggregated_holdings AS (
    SELECT
        user_id,
        asset,
        
        -- For simplicity, we select one cost_currency if multiple exist (e.g., BTC bought with JPY and USDT).
        -- MAX() is a deterministic way to pick one.
        MAX(cost_currency) AS cost_currency,

        -- Calculate total amounts and costs from buys
        SUM(CASE WHEN side = 'buy' THEN amount ELSE 0 END) AS total_bought_amount,
        SUM(CASE WHEN side = 'buy' THEN price * amount ELSE 0 END) AS total_buy_cost,

        -- Calculate total amounts and proceeds from sells
        SUM(CASE WHEN side = 'sell' THEN amount ELSE 0 END) AS total_sold_amount,
        SUM(CASE WHEN side = 'sell' THEN price * amount ELSE 0 END) AS total_sell_proceeds,

        -- Sum up deposits and withdrawals from wallets
        SUM(CASE WHEN side = 'deposit' THEN amount ELSE 0 END) AS total_deposited,
        SUM(CASE WHEN side = 'withdrawal' THEN amount ELSE 0 END) AS total_withdrawn
    FROM all_transactions
    GROUP BY user_id, asset
)

-- Step 3: Final calculation of P&L, current holdings, and cost basis
SELECT
    user_id,
    asset,
    cost_currency, -- CORRECTED: Providing the cost_currency column

    -- Calculate the average cost per unit for all assets ever bought.
    (CASE WHEN total_bought_amount > 0 THEN total_buy_cost / total_bought_amount ELSE 0 END) AS average_buy_price,

    -- REALIZED P&L: The profit or loss from completed sales.
    (total_sell_proceeds - (CASE WHEN total_bought_amount > 0 THEN (total_buy_cost / total_bought_amount) * total_sold_amount ELSE 0 END)) AS realized_pnl,

    -- CURRENT HOLDINGS: The amount of asset the user currently holds.
    (total_bought_amount + total_deposited - total_sold_amount - total_withdrawn) AS current_amount,

    -- TOTAL COST (Cost Basis): The total cost of the assets currently held.
    -- CORRECTED: The column is now correctly named `total_cost`.
    ((total_bought_amount + total_deposited - total_sold_amount - total_withdrawn) * (CASE WHEN total_bought_amount > 0 THEN (total_buy_cost / total_bought_amount) ELSE 0 END)) AS total_cost

FROM
    aggregated_holdings
-- Optional: Filter out assets where the holding amount is negligible (dust).
WHERE
    (total_bought_amount + total_deposited - total_sold_amount - total_withdrawn) > 1e-9;
