-- supabase/migrations/20251216_fix_holdings_calculation.sql
-- PURPOSE: Modify the final holdings view to exclude internal transfers from calculations.

-- Drop the existing view to redefine it.
DROP VIEW IF EXISTS public.v_holdings CASCADE;

-- =================================================================
-- VIEW: v_holdings
-- PURPOSE: Calculates the current holdings, average buy price, and PnL for each asset,
--          CORRECTLY ignoring internal transfers.
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS

WITH relevant_transactions AS (
    -- Step 1: Filter out internal transfers at the very beginning.
    -- This is the crucial fix.
    SELECT
        user_id,
        asset,
        date,
        amount,
        price,
        transaction_type,
        quote_asset
    FROM
        public.v_all_transactions_classified
    WHERE
        -- ★★★ THE FIX ★★★
        -- Only consider transactions that are NOT internal transfers for holdings calculation.
        transaction_type <> 'INTERNAL_TRANSFER'
),

cumulative_transactions AS (
    -- Step 2: Calculate cumulative amounts for buys and sells.
    SELECT
        *,
        -- Cumulative sum of asset bought/received
        SUM(CASE WHEN transaction_type = 'BUY' THEN amount ELSE 0 END)
            OVER (PARTITION BY user_id, asset ORDER BY date, amount) as cumulative_buy_amount,
        -- Cumulative sum of cost for buys
        SUM(CASE WHEN transaction_type = 'BUY' THEN amount * price ELSE 0 END)
            OVER (PARTITION BY user_id, asset ORDER BY date, amount) as cumulative_buy_cost,
        -- Cumulative sum of asset sold/sent
        SUM(CASE WHEN transaction_type = 'SELL' THEN amount ELSE 0 END)
            OVER (PARTITION BY user_id, asset ORDER BY date, amount) as cumulative_sell_amount
    FROM
        relevant_transactions
),

final_holdings AS (
    -- Step 3: Determine the final state for each asset for each user.
    SELECT
        user_id,
        asset,
        -- Select the last transaction record for each asset
        LAST_VALUE(cumulative_buy_amount) OVER (PARTITION BY user_id, asset ORDER BY date, amount) as total_buy_amount,
        LAST_VALUE(cumulative_buy_cost) OVER (PARTITION BY user_id, asset ORDER BY date, amount) as total_buy_cost,
        LAST_VALUE(cumulative_sell_amount) OVER (PARTITION BY user_id, asset ORDER BY date, amount) as total_sell_amount
    FROM
        cumulative_transactions
)

-- Step 4: Aggregate and calculate the final metrics.
SELECT DISTINCT
    f.user_id,
    f.asset,
    -- Current Amount = Total Buys - Total Sells
    (f.total_buy_amount - f.total_sell_amount) as current_amount,
    -- Average Buy Price = Total Cost / Total Amount Bought
    CASE
        WHEN f.total_buy_amount > 0 THEN f.total_buy_cost / f.total_buy_amount
        ELSE 0
    END as average_buy_price,
    -- Note: Realized PnL and Total Cost would require more complex logic, focusing on fixing the balance for now.
    0 as realized_pnl, -- Placeholder for realized PnL
    f.total_buy_cost as total_cost -- This is total cost of all buys, not of current holdings
FROM
    final_holdings f
WHERE
    (f.total_buy_amount - f.total_sell_amount) > 0; -- Only show assets the user currently holds
