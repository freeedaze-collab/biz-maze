
-- supabase/migrations/20240524200000_create_financial_statement_views.sql
-- PURPOSE: Creates the initial financial statement views for P&L and B/S based on IFRS rules.
-- DEPENDS ON: The 'usage' column in the 'all_transactions' view.

-- Ensure we start fresh
DROP VIEW IF EXISTS public.v_profit_and_loss CASCADE;
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;

-- =================================================================
-- VIEW 1: v_profit_and_loss (Profit and Loss Statement)
-- Translates transaction usages into P&L accounts according to IFRS.
-- =================================================================
CREATE OR REPLACE VIEW public.v_profit_and_loss AS
SELECT
    t.user_id,
    -- 1. Classify transaction 'usage' into P&L account types (e.g., Revenue, Expense)
    CASE
        -- Revenue & Cost of Sales (IAS 2 / IFRS 15)
        WHEN t.usage = 'sale_ias2' THEN 'Revenue'
        WHEN t.usage = 'sale_ias2' THEN 'Cost of Sales' -- This will be a separate entry
        WHEN t.usage = 'revenue_ifrs15' THEN 'Revenue'
        
        -- Other Income
        WHEN t.usage IN ('mining_rewards', 'staking_rewards') THEN 'Other Income'
        
        -- Expenses & Losses
        WHEN t.usage = 'gas_fees' THEN 'Operating Expenses'
        WHEN t.usage = 'impairment_ias38' THEN 'Impairment Loss'
        WHEN t.usage = 'lcnrv_ias2' THEN 'Inventory Write-Down'
        WHEN t.usage = 'loss_unrecoverable' THEN 'Loss on Derecognition'
        WHEN t.usage = 'revaluation_decrease_ias38' AND t.value_in_usd IS NOT NULL THEN 'Revaluation Loss' -- P&L part
        
        -- Gains
        WHEN t.usage = 'fvlcs_ias2' THEN 'Fair Value Gain/Loss'
        WHEN t.usage = 'sale_ias38' THEN 'Gain/Loss on Sale of Intangible Assets'
        WHEN t.usage = 'crypto_to_crypto_exchange' THEN 'Gain/Loss on Exchange'

        -- OCI (Other Comprehensive Income)
        WHEN t.usage = 'revaluation_increase_ias38' THEN 'Revaluation Surplus (OCI)'

        ELSE NULL -- Ignore transactions not impacting P&L
    END AS account,

    -- 2. Calculate the monetary impact for each account
    SUM(
        CASE
            -- Revenue is the value received
            WHEN t.usage IN ('sale_ias2', 'revenue_ifrs15') THEN t.value_in_usd
            
            -- Other Income from rewards is the value at time of receipt
            WHEN t.usage IN ('mining_rewards', 'staking_rewards') THEN t.value_in_usd

            -- Cost of Sales: This is complex and requires knowing the cost of the specific inventory sold.
            -- This is a placeholder; a more advanced version would use FIFO/WAC.
            WHEN t.usage = 'sale_ias2' THEN -t.acquisition_price_total -- Simplified: assumes acquisition price is COGS

            -- Expenses are the value of the crypto spent/lost
            WHEN t.usage IN ('gas_fees', 'impairment_ias38', 'lcnrv_ias2', 'loss_unrecoverable', 'revaluation_decrease_ias38') THEN -t.value_in_usd
            
            -- Gains/Losses from sales or exchanges
            WHEN t.usage = 'sale_ias38' THEN t.value_in_usd - t.acquisition_price_total -- Proceeds vs Cost
            WHEN t.usage = 'crypto_to_crypto_exchange' THEN t.value_in_usd - t.acquisition_price_total -- Fair value of asset received vs cost of asset given up

            -- Fair value adjustments for broker-traders
            WHEN t.usage = 'fvlcs_ias2' THEN t.value_in_usd -- The change in fair value

            -- OCI revaluation surplus
            WHEN t.usage = 'revaluation_increase_ias38' THEN t.value_in_usd

            ELSE 0
        END
    ) AS balance

FROM public.all_transactions t
WHERE 
    t.user_id IS NOT NULL AND
    t.value_in_usd IS NOT NULL AND
    t.usage IS NOT NULL AND
    -- 3. Filter for usages that have a P&L or OCI impact
    t.usage IN (
        'sale_ias2', 'revenue_ifrs15', 'mining_rewards', 'staking_rewards', 'gas_fees', 
        'impairment_ias38', 'lcnrv_ias2', 'loss_unrecoverable', 'revaluation_decrease_ias38', 
        'fvlcs_ias2', 'sale_ias38', 'crypto_to_crypto_exchange', 'revaluation_increase_ias38'
    )
GROUP BY t.user_id, account;


-- =================================================================
-- VIEW 2: v_balance_sheet (Balance Sheet)
-- Tracks the balances of Assets, Liabilities, and Equity accounts.
-- =================================================================
CREATE OR REPLACE VIEW public.v_balance_sheet AS
WITH account_movements AS (
    SELECT
        t.user_id,
        -- 1. Classify transaction 'usage' into Balance Sheet account types
        CASE
            -- Asset Movements (Crypto)
            WHEN t.usage IN ('investment_acquisition_ias38', 'mining_rewards', 'staking_rewards', 'revenue_ifrs15', 'revaluation_increase_ias38') THEN 'Intangible Assets'
            WHEN t.usage = 'trading_acquisition_ias2' THEN 'Inventories'
            WHEN t.usage = 'sale_ias38' THEN 'Intangible Assets' -- Decrease
            WHEN t.usage = 'sale_ias2' THEN 'Inventories' -- Decrease
            WHEN t.usage = 'gas_fees' THEN CASE WHEN t.asset IN ('BTC', 'ETH') THEN 'Intangible Assets' ELSE 'Inventories' END -- Crude split, needs refinement
            WHEN t.usage IN ('impairment_ias38', 'loss_unrecoverable', 'revaluation_decrease_ias38') THEN 'Intangible Assets' -- Decrease
            WHEN t.usage = 'lcnrv_ias2' THEN 'Inventories' -- Decrease
            WHEN t.usage = 'crypto_to_crypto_exchange' AND t.type = 'buy' THEN 'Intangible Assets' -- Inflow
            WHEN t.usage = 'crypto_to_crypto_exchange' AND t.type = 'sell' THEN 'Intangible Assets' -- Outflow

            -- Asset Movements (Cash)
            WHEN t.usage IN ('investment_acquisition_ias38', 'trading_acquisition_ias2') THEN 'Cash' -- Decrease
            WHEN t.usage IN ('sale_ias38', 'sale_ias2') THEN 'Cash' -- Increase
            
            ELSE NULL
        END AS account,

        -- 2. Calculate the value change for each movement
        SUM(
            CASE 
                -- Asset Increases
                WHEN t.usage IN ('investment_acquisition_ias38', 'trading_acquisition_ias2', 'mining_rewards', 'staking_rewards', 'revenue_ifrs15', 'revaluation_increase_ias38') THEN t.value_in_usd
                WHEN t.usage = 'crypto_to_crypto_exchange' AND t.type = 'buy' THEN t.value_in_usd
                WHEN t.usage IN ('sale_ias38', 'sale_ias2') THEN t.value_in_usd -- Cash increases by sale value

                -- Asset Decreases
                WHEN t.usage IN ('investment_acquisition_ias38', 'trading_acquisition_ias2') THEN -t.value_in_usd -- Cash decreases
                WHEN t.usage = 'sale_ias38' THEN -t.acquisition_price_total -- Asset decreases by its original cost
                WHEN t.usage = 'sale_ias2' THEN -t.acquisition_price_total -- Inventory decreases by its cost
                WHEN t.usage IN ('gas_fees', 'impairment_ias38', 'loss_unrecoverable', 'revaluation_decrease_ias38', 'lcnrv_ias2') THEN -t.value_in_usd
                WHEN t.usage = 'crypto_to_crypto_exchange' AND t.type = 'sell' THEN -t.acquisition_price_total -- Asset given up

                ELSE 0
            END
        ) AS balance_change

    FROM public.all_transactions t
    WHERE t.user_id IS NOT NULL AND t.value_in_usd IS NOT NULL AND t.usage IS NOT NULL
    GROUP BY t.user_id, account

), net_income AS (
    -- Calculate Net Income from the P&L view to include in Equity
    SELECT user_id, SUM(balance) as total_net_income
    FROM public.v_profit_and_loss
    WHERE account <> 'Revaluation Surplus (OCI)'
    GROUP BY user_id
), oci AS (
    -- Calculate Other Comprehensive Income
    SELECT user_id, SUM(balance) as total_oci
    FROM public.v_profit_and_loss
    WHERE account = 'Revaluation Surplus (OCI)'
    GROUP BY user_id
)
-- Final aggregation for the Balance Sheet
SELECT 
    m.user_id,
    m.account,
    SUM(m.balance_change) as balance
FROM account_movements m
WHERE m.account IS NOT NULL
GROUP BY m.user_id, m.account

UNION ALL

-- Add Retained Earnings (from Net Income)
SELECT 
    ni.user_id, 
    'Retained Earnings' as account,
    ni.total_net_income as balance
FROM net_income ni

UNION ALL

-- Add Revaluation Surplus (from OCI)
SELECT 
    o.user_id, 
    'Revaluation Surplus' as account,
    o.total_oci as balance
FROM oci o;
