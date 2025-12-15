
-- PURPOSE: Adds the `date` column to financial statement views for daily reporting.
-- DEPENDS ON: `all_transactions.date` column.

-- Drop existing views to be safe with dependencies
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;


-- =================================================================
-- VIEW 1: v_profit_loss_statement (with date)
-- =================================================================
CREATE OR REPLACE VIEW public.v_profit_loss_statement AS
WITH pnl_items AS (
    -- Revenue & Other Income
    SELECT user_id, date, 'Sales Revenue (IAS 2)'::text AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage = 'sale_ias2' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, date, 'Consideration Revenue (IFRS 15)'::text, value_in_usd FROM public.all_transactions WHERE usage = 'revenue_ifrs15' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, date, 'Staking & Mining Rewards'::text, value_in_usd FROM public.all_transactions WHERE usage = ANY (ARRAY['mining_rewards'::text, 'staking_rewards'::text]) AND value_in_usd IS NOT NULL
    UNION ALL
    -- Expenses & Losses
    SELECT user_id, date, 'Cost of Goods Sold (IAS 2)'::text, -value_in_usd FROM public.all_transactions WHERE usage = 'sale_ias2'
    UNION ALL
    SELECT user_id, date, 'Unrealized Gains on Intangibles (Revaluation)'::text, value_in_usd FROM public.all_transactions WHERE usage = 'revaluation_increase_ias38'::text
    UNION ALL
    SELECT user_id, date, 'Unrealized Losses on Intangibles (Impairment)'::text, -value_in_usd FROM public.all_transactions WHERE usage = ANY (ARRAY['impairment_ias38'::text, 'revaluation_decrease_ias38'::text])
    UNION ALL
    SELECT user_id, date, 'Realized Gains on Intangibles (Sale)'::text, 0 FROM public.all_transactions WHERE usage = 'sale_ias38'::text
    UNION ALL
    SELECT user_id, date, 'Gas & Network Fees'::text, -value_in_usd FROM public.all_transactions WHERE usage = 'gas_fees'::text AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, date, 'Loss of Crypto (Unrecoverable)'::text, -value_in_usd FROM public.all_transactions WHERE usage = 'loss_unrecoverable'::text AND value_in_usd IS NOT NULL
)
SELECT
    user_id,
    date,
    account,
    SUM(balance) AS balance
FROM pnl_items
WHERE user_id IS NOT NULL AND balance IS NOT NULL
GROUP BY user_id, date, account
ORDER BY user_id, date, account;


-- =================================================================
-- VIEW 2: v_cash_flow_statement (with date)
-- =================================================================
CREATE OR REPLACE VIEW public.v_cash_flow_statement AS
WITH cash_flows AS (
    SELECT user_id, date, 'Inflow from Sales (IAS 2 & IFRS 15)'::text AS item, sum(value_in_usd) AS cash_flow FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'revenue_ifrs15'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Outflow for Inventory (IAS 2)'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2'::text GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Outflow for Gas Fees'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = 'gas_fees'::text GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Outflow for Intangible Assets'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = 'investment_acquisition_ias38'::text GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Inflow from Sale of Intangibles'::text, sum(value_in_usd) FROM public.all_transactions WHERE usage = 'sale_ias38'::text GROUP BY user_id, date
)
SELECT
    user_id,
    date,
    item,
    SUM(cash_flow) AS amount
FROM cash_flows
WHERE user_id IS NOT NULL AND cash_flow IS NOT NULL
GROUP BY user_id, date, item
ORDER BY user_id, date,
    CASE item
        WHEN 'Inflow from Sales (IAS 2 & IFRS 15)'::text THEN 1
        WHEN 'Outflow for Inventory (IAS 2)'::text THEN 2
        WHEN 'Outflow for Gas Fees'::text THEN 3
        WHEN 'Outflow for Intangible Assets'::text THEN 4
        WHEN 'Inflow from Sale of Intangibles'::text THEN 5
        ELSE 99
    END;

-- =================================================================
-- VIEW 3: v_balance_sheet (with date)
-- =================================================================
CREATE OR REPLACE VIEW public.v_balance_sheet AS
WITH account_movements AS (
    -- Asset Movements from all_transactions
    SELECT user_id, date, 'Intangible Assets (Investing Crypto)'::text AS account, sum(value_in_usd) AS balance_change FROM public.all_transactions WHERE usage = ANY (ARRAY['investment_acquisition_ias38'::text, 'mining_rewards'::text, 'staking_rewards'::text, 'revenue_ifrs15'::text, 'revaluation_increase_ias38'::text, 'crypto_to_crypto_exchange'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Inventory (Trading Crypto)'::text, sum(value_in_usd) FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2'::text GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Intangible Assets (Investing Crypto)'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias38'::text, 'impairment_ias38'::text, 'loss_unrecoverable'::text, 'revaluation_decrease_ias38'::text, 'gas_fees'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Inventory (Trading Crypto)'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'lcnrv_ias2'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Cash & Cash Equivalents'::text, sum(value_in_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias38'::text, 'sale_ias2'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Cash & Cash Equivalents'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['investment_acquisition_ias38'::text, 'trading_acquisition_ias2'::text, 'crypto_to_crypto_exchange'::text]) GROUP BY user_id, date
    
    -- Equity Movements from the now-daily v_profit_loss_statement
    UNION ALL
    SELECT p.user_id, p.date, 'Retained Earnings'::text, sum(p.balance) FROM public.v_profit_loss_statement p WHERE p.account <> 'Unrealized Gains on Intangibles (Revaluation)'::text GROUP BY p.user_id, p.date
    UNION ALL
    SELECT p.user_id, p.date, 'Revaluation Surplus'::text, sum(p.balance) FROM public.v_profit_loss_statement p WHERE p.account = 'Unrealized Gains on Intangibles (Revaluation)'::text GROUP BY p.user_id, p.date
)
SELECT
    user_id,
    date,
    account,
    SUM(balance_change) AS balance
FROM account_movements m
WHERE account IS NOT NULL AND balance_change IS NOT NULL
GROUP BY user_id, date, account
ORDER BY user_id, date, account;
