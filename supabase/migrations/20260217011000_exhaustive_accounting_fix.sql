-- Migration: Comprehensive Accounting View Fix (V42)
-- Ensures all required columns for all three financial statements are present and correctly mapped.

-- 1. Drop existing views
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;

-- 2. Profit & Loss Statement (Ensuring 'account', 'balance', and all currency columns)
CREATE OR REPLACE VIEW public.v_profit_loss_statement WITH (security_invoker = true) AS
SELECT 
    user_id, 
    entity_id, 
    entity_name, 
    date, 
    account, -- Identifying column
    balance_usd AS balance, -- Default balance alias
    balance_usd,
    balance_jpy,
    balance_eur,
    balance_gbp,
    balance_inr,
    balance_sgd
FROM (
    SELECT 
        user_id, entity_id, entity_name, date, account,
        SUM(val_usd) AS balance_usd,
        SUM(val_jpy) AS balance_jpy,
        SUM(val_eur) AS balance_eur,
        SUM(val_gbp) AS balance_gbp,
        SUM(val_inr) AS balance_inr,
        SUM(val_sgd) AS balance_sgd
    FROM (
        SELECT user_id, entity_id, entity_name, date, 'Sales Revenue (IAS 2)'::text AS account, value_usd AS val_usd, value_jpy AS val_jpy, value_eur AS val_eur, value_gbp AS val_gbp, value_inr AS val_inr, value_sgd AS val_sgd FROM public.all_transactions WHERE usage = 'sale_ias2'
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Consideration Revenue (IFRS 15)'::text, value_usd, value_jpy, value_eur, value_gbp, value_inr, value_sgd FROM public.all_transactions WHERE usage = 'revenue_ifrs15'
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Staking & Mining Rewards'::text, value_usd, value_jpy, value_eur, value_gbp, value_inr, value_sgd FROM public.all_transactions WHERE usage = ANY (ARRAY['mining_rewards'::text, 'staking_rewards'::text])
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cost of Goods Sold (IAS 2)'::text, -value_usd, -value_jpy, -value_eur, -value_gbp, -value_inr, -value_sgd FROM public.all_transactions WHERE usage = 'sale_ias2'
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Unrealized Gains on Intangibles (Revaluation)'::text, value_usd, value_jpy, value_eur, value_gbp, value_inr, value_sgd FROM public.all_transactions WHERE usage = 'revaluation_increase_ias38'
    ) sub
    GROUP BY user_id, entity_id, entity_name, date, account
) p;

-- 3. Balance Sheet (Ensuring 'account', 'balance', and all currency columns)
CREATE OR REPLACE VIEW public.v_balance_sheet WITH (security_invoker = true) AS
SELECT 
    user_id, 
    entity_id, 
    entity_name, 
    date, 
    account, -- Identifying column
    balance_usd AS balance, -- Default balance alias
    balance_usd,
    balance_jpy,
    balance_eur,
    balance_gbp,
    balance_inr,
    balance_sgd
FROM (
    SELECT 
        user_id, entity_id, entity_name, date, account,
        SUM(chg_usd) AS balance_usd,
        SUM(chg_jpy) AS balance_jpy,
        SUM(chg_eur) AS balance_eur,
        SUM(chg_gbp) AS balance_gbp,
        SUM(chg_inr) AS balance_inr,
        SUM(chg_sgd) AS balance_sgd
    FROM (
        SELECT user_id, entity_id, entity_name, date, 'Inventory (Trading Crypto)'::text AS account, value_usd AS chg_usd, value_jpy AS chg_jpy, value_eur AS chg_eur, value_gbp AS chg_gbp, value_inr AS chg_inr, value_sgd AS chg_sgd FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2'
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Inventory (Trading Crypto)'::text, -value_usd, -value_jpy, -value_eur, -value_gbp, -value_inr, -value_sgd FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'lcnrv_ias2'::text])
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash & Cash Equivalents'::text, value_usd, value_jpy, value_eur, value_gbp, value_inr, value_sgd FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias38'::text, 'sale_ias2'::text])
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash & Cash Equivalents'::text, -value_usd, -value_jpy, -value_eur, -value_gbp, -value_inr, -value_sgd FROM public.all_transactions WHERE usage = ANY (ARRAY['investment_acquisition_ias38'::text, 'trading_acquisition_ias2'::text])
    ) sub
    GROUP BY user_id, entity_id, entity_name, date, account
) b;

-- 4. Cash Flow Statement (Ensuring 'item', 'amount', and all currency columns)
CREATE OR REPLACE VIEW public.v_cash_flow_statement WITH (security_invoker = true) AS
SELECT 
    user_id, 
    entity_id, 
    entity_name, 
    date, 
    item, -- Identifying column
    amount_usd AS amount, -- Default amount alias
    amount_usd,
    amount_jpy,
    amount_eur,
    amount_gbp,
    amount_inr,
    amount_sgd
FROM (
    SELECT 
        user_id, entity_id, entity_name, date, item,
        SUM(val_usd) AS amount_usd,
        SUM(val_jpy) AS amount_jpy,
        SUM(val_eur) AS amount_eur,
        SUM(val_gbp) AS amount_gbp,
        SUM(val_inr) AS amount_inr,
        SUM(val_sgd) AS amount_sgd
    FROM (
        SELECT user_id, entity_id, entity_name, date, 'Cash In from Sales'::text AS item, value_usd AS val_usd, value_jpy AS val_jpy, value_eur AS val_eur, value_gbp AS val_gbp, value_inr AS val_inr, value_sgd AS val_sgd FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'sale_ias38'::text])
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash Out for Inventory'::text, -value_usd, -value_jpy, -value_eur, -value_gbp, -value_inr, -value_sgd FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2'
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash Out for Gas Fees'::text, -value_usd, -value_jpy, -value_eur, -value_gbp, -value_inr, -value_sgd FROM public.all_transactions WHERE usage = 'gas_fees'
        UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash Out for Intangibles'::text, -value_usd, -value_jpy, -value_eur, -value_gbp, -value_inr, -value_sgd FROM public.all_transactions WHERE usage = 'investment_acquisition_ias38'
    ) sub
    GROUP BY user_id, entity_id, entity_name, date, item
) cf;

-- 5. Permissions
GRANT SELECT ON public.v_profit_loss_statement TO authenticated, service_role;
GRANT SELECT ON public.v_balance_sheet TO authenticated, service_role;
GRANT SELECT ON public.v_cash_flow_statement TO authenticated, service_role;
