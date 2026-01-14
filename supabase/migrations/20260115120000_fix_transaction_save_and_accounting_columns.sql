-- 20260115120000_fix_transaction_save_and_accounting_columns.sql

-- 1. Fix RLS for Transactions
-- Enable RLS for exchange_trades if not already enabled
ALTER TABLE public.exchange_trades ENABLE ROW LEVEL SECURITY;

-- Add policies for exchange_trades
DROP POLICY IF EXISTS "Users can manage their own exchange trades" ON public.exchange_trades;
CREATE POLICY "Users can select their own exchange trades" ON public.exchange_trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own exchange trades" ON public.exchange_trades
    FOR UPDATE USING (auth.uid() = user_id);

-- Add update policy for wallet_transactions
DROP POLICY IF EXISTS "Users can update their own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can update their own wallet transactions" ON public.wallet_transactions
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. Redefine Accounting Views with missing aliases and entity name

-- P&L View
DROP VIEW IF EXISTS public.v_profit_loss_statement;
CREATE VIEW public.v_profit_loss_statement AS
SELECT 
    user_id,
    entity_id,
    entity_name as entity,
    date,
    CASE 
        WHEN usage = 'staking_rewards' THEN 'Other Revenue / Sales'
        WHEN usage = 'sale_profit' THEN 'Realized Gain (Non-operating)'
        WHEN usage = 'sale_loss' THEN 'Realized Loss (Non-operating)'
        WHEN usage = 'fair_value_gain' THEN 'Fair Value Gain (Non-operating)'
        WHEN usage = 'fair_value_loss' THEN 'Fair Value Loss (Non-operating)'
        WHEN usage = 'impairment_loss' THEN 'Impairment Loss (Extraordinary)'
        WHEN usage = 'payment_in_crypto' THEN 'Realized Gain (Deemed)'
        ELSE usage
    END as account,
    value_usd as balance,
    value_usd as balance_usd,
    value_jpy as balance_jpy,
    value_eur as balance_eur
FROM public.v_all_transactions_classified
WHERE usage IS NOT NULL AND usage != 'cash_purchase' AND transaction_type != 'INTERNAL_TRANSFER';

-- Balance Sheet View
DROP VIEW IF EXISTS public.v_balance_sheet;
CREATE VIEW public.v_balance_sheet AS
SELECT 
    user_id,
    entity_id,
    entity as entity_name,
    timezone('utc'::text, now()) as date,
    'Cryptocurrency Assets' as account,
    current_value_usd as balance,
    current_value_usd as balance_usd,
    current_value_jpy as balance_jpy,
    current_value_eur as balance_eur
FROM public.v_holdings;

-- Cash Flow View
DROP VIEW IF EXISTS public.v_cash_flow_statement;
CREATE VIEW public.v_cash_flow_statement AS
-- Net Income (Starting point)
SELECT 
    user_id,
    entity_id,
    entity_name as entity,
    now() as date,
    'Net Income (Reconciliation Start)' as item,
    SUM(CASE WHEN usage IN ('sale_profit', 'staking_rewards', 'payment_in_crypto') THEN value_usd ELSE -value_usd END) as amount,
    SUM(CASE WHEN usage IN ('sale_profit', 'staking_rewards', 'payment_in_crypto') THEN value_usd ELSE -value_usd END) as amount_usd,
    SUM(CASE WHEN usage IN ('sale_profit', 'staking_rewards', 'payment_in_crypto') THEN value_jpy ELSE -value_jpy END) as amount_jpy,
    SUM(CASE WHEN usage IN ('sale_profit', 'staking_rewards', 'payment_in_crypto') THEN value_eur ELSE -value_eur END) as amount_eur
FROM public.v_all_transactions_classified
WHERE usage IS NOT NULL AND usage != 'cash_purchase' AND transaction_type != 'INTERNAL_TRANSFER'
GROUP BY user_id, entity_id, entity_name

UNION ALL

-- Operating Adjustments
SELECT 
    user_id,
    entity_id,
    entity_name as entity,
    date,
    CASE 
        WHEN usage = 'fair_value_gain' THEN 'Adj: Fair Value Gain'
        WHEN usage = 'fair_value_loss' THEN 'Adj: Fair Value Loss'
        WHEN usage = 'impairment_loss' THEN 'Adj: Impairment Loss'
        WHEN usage = 'sale_profit' THEN 'Adj: Sale Profit'
        WHEN usage = 'sale_loss' THEN 'Adj: Sale Loss'
        WHEN usage = 'staking_rewards' THEN 'Adj: Non-cash Rewards'
        WHEN usage = 'payment_in_crypto' THEN 'Adj: Deemed Sale Gain'
        ELSE usage
    END as item,
    CASE 
        WHEN usage IN ('fair_value_gain', 'sale_profit', 'staking_rewards', 'payment_in_crypto') THEN -value_usd 
        ELSE value_usd 
    END as amount,
    CASE 
        WHEN usage IN ('fair_value_gain', 'sale_profit', 'staking_rewards', 'payment_in_crypto') THEN -value_usd 
        ELSE value_usd 
    END as amount_usd,
    CASE 
        WHEN usage IN ('fair_value_gain', 'sale_profit', 'staking_rewards', 'payment_in_crypto') THEN -value_jpy 
        ELSE value_jpy 
    END as amount_jpy,
    CASE 
        WHEN usage IN ('fair_value_gain', 'sale_profit', 'staking_rewards', 'payment_in_crypto') THEN -value_eur 
        ELSE value_eur 
    END as amount_eur
FROM public.v_all_transactions_classified
WHERE usage IN ('fair_value_gain', 'fair_value_loss', 'impairment_loss', 'sale_profit', 'sale_loss', 'staking_rewards', 'payment_in_crypto')

UNION ALL

-- Investing Activities
SELECT 
    user_id,
    entity_id,
    entity_name as entity,
    date,
    'Acquisition of Crypto Assets' as item,
    -value_usd as amount,
    -value_usd as amount_usd,
    -value_jpy as amount_jpy,
    -value_eur as amount_eur
FROM public.v_all_transactions_classified
WHERE usage = 'cash_purchase'

UNION ALL

SELECT 
    user_id,
    entity_id,
    entity_name as entity,
    date,
    'Proceeds from Sale of Crypto Assets' as item,
    value_usd as amount,
    value_usd as amount_usd,
    value_jpy as amount_jpy,
    value_eur as amount_eur
FROM public.v_all_transactions_classified
WHERE usage IN ('sale_profit', 'sale_loss');

-- Step 3: Grant permissions
GRANT SELECT ON public.v_holdings TO authenticated, service_role;
GRANT SELECT ON public.v_profit_loss_statement TO authenticated, service_role;
GRANT SELECT ON public.v_balance_sheet TO authenticated, service_role;
GRANT SELECT ON public.v_cash_flow_statement TO authenticated, service_role;
