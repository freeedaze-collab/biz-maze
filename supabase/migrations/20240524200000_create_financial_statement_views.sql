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
WITH pnl_items AS (
    -- USE UNION ALL to create separate rows for multi-account impacts (e.g., Sale of Inventory)
    -- Revenue & Other Income
    SELECT user_id, 'Revenue' AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage IN ('sale_ias2', 'revenue_ifrs15') AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Other Income' AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage IN ('mining_rewards', 'staking_rewards') AND value_in_usd IS NOT NULL
    UNION ALL
    -- Cost of Sales (approximated as acquisition_price_total)
    SELECT user_id, 'Cost of Sales' AS account, -acquisition_price_total AS balance FROM public.all_transactions WHERE usage = 'sale_ias2' AND acquisition_price_total IS NOT NULL
    UNION ALL
    -- Expenses & Losses
    SELECT user_id, 'Operating Expenses' AS account, -value_in_usd AS balance FROM public.all_transactions WHERE usage = 'gas_fees' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Impairment Loss' AS account, -value_in_usd AS balance FROM public.all_transactions WHERE usage = 'impairment_ias38' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Inventory Write-Down' AS account, -value_in_usd AS balance FROM public.all_transactions WHERE usage = 'lcnrv_ias2' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Loss on Derecognition' AS account, -value_in_usd AS balance FROM public.all_transactions WHERE usage = 'loss_unrecoverable' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Revaluation Loss' AS account, -value_in_usd AS balance FROM public.all_transactions WHERE usage = 'revaluation_decrease_ias38' AND value_in_usd IS NOT NULL
    UNION ALL
    -- Gains / Losses on Sales and Exchanges
    SELECT user_id, 'Gain/Loss on Sale' AS account, (value_in_usd - acquisition_price_total) AS balance FROM public.all_transactions WHERE usage = 'sale_ias38' AND value_in_usd IS NOT NULL AND acquisition_price_total IS NOT NULL
    UNION ALL
    SELECT user_id, 'Gain/Loss on Exchange' AS account, (value_in_usd - acquisition_price_total) AS balance FROM public.all_transactions WHERE usage = 'crypto_to_crypto_exchange' AND value_in_usd IS NOT NULL AND acquisition_price_total IS NOT NULL
    UNION ALL
    -- OCI
    SELECT user_id, 'Revaluation Surplus (OCI)' AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage = 'revaluation_increase_ias38' AND value_in_usd IS NOT NULL
)
SELECT
    user_id,
    account,
    SUM(balance) AS balance
FROM pnl_items
WHERE user_id IS NOT NULL
GROUP BY user_id, account
ORDER BY user_id, account;


-- =================================================================
-- VIEW 2: v_balance_sheet (Balance Sheet)
-- Tracks the balances of Assets, Liabilities, and Equity accounts.
-- =================================================================
CREATE OR REPLACE VIEW public.v_balance_sheet AS
WITH account_movements AS (
    -- ASSETS
    SELECT user_id, 'Intangible Assets' AS account, SUM(value_in_usd) as balance_change FROM public.all_transactions WHERE usage IN ('investment_acquisition_ias38', 'mining_rewards', 'staking_rewards', 'revenue_ifrs15', 'revaluation_increase_ias38') GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Inventories' AS account, SUM(value_in_usd) as balance_change FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Intangible Assets' AS account, SUM(-acquisition_price_total) as balance_change FROM public.all_transactions WHERE usage = 'sale_ias38' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Inventories' AS account, SUM(-acquisition_price_total) as balance_change FROM public.all_transactions WHERE usage = 'sale_ias2' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Intangible Assets' AS account, SUM(-value_in_usd) as balance_change FROM public.all_transactions WHERE usage IN ('impairment_ias38', 'loss_unrecoverable', 'revaluation_decrease_ias38', 'gas_fees') GROUP BY user_id -- Assuming gas fees paid from intangible holdings
    UNION ALL
    SELECT user_id, 'Inventories' AS account, SUM(-value_in_usd) as balance_change FROM public.all_transactions WHERE usage = 'lcnrv_ias2' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Cash' AS account, SUM(value_in_usd) as balance_change FROM public.all_transactions WHERE usage IN ('sale_ias38', 'sale_ias2') GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Cash' AS account, SUM(-value_in_usd) as balance_change FROM public.all_transactions WHERE usage IN ('investment_acquisition_ias38', 'trading_acquisition_ias2') GROUP BY user_id

    -- EQUITY
    UNION ALL
    SELECT p.user_id, 'Retained Earnings' AS account, SUM(p.balance) AS balance_change
    FROM public.v_profit_and_loss p
    WHERE p.account <> 'Revaluation Surplus (OCI)'
    GROUP BY p.user_id
    UNION ALL
    SELECT p.user_id, 'Revaluation Surplus' AS account, SUM(p.balance) AS balance_change
    FROM public.v_profit_and_loss p
    WHERE p.account = 'Revaluation Surplus (OCI)'
    GROUP BY p.user_id
)
SELECT
    m.user_id,
    m.account,
    SUM(m.balance_change) AS balance
FROM account_movements m
WHERE m.account IS NOT NULL
GROUP BY m.user_id, m.account
ORDER BY user_id, account;
