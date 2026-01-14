-- 20260115_overhaul_financial_logic.sql

-- 1. Refresh usage categories (Upsert)
INSERT INTO public.usage_categories (key, description) VALUES
('cash_purchase', 'Cash Purchase'),
('fair_value_gain', 'Fair Value Gain (Year-end)'),
('fair_value_loss', 'Fair Value Loss (Year-end)'),
('impairment_loss', 'Impairment Loss'),
('sale_profit', 'Sale Profit (Realized Gain)'),
('sale_loss', 'Sale Loss (Realized Loss)'),
('staking_rewards', 'Staking Rewards (Crypto)'),
('payment_in_crypto', 'Payment in Crypto')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- 2. Migrate existing usages to new keys (Best Effort)
UPDATE public.wallet_transactions 
SET usage = CASE 
    WHEN usage IN ('investment_acquisition_ias38', 'trading_acquisition_ias2') THEN 'cash_purchase'
    WHEN usage IN ('mining_rewards', 'staking_rewards') THEN 'staking_rewards'
    WHEN usage = 'impairment_ias38' THEN 'impairment_loss'
    WHEN usage = 'revaluation_increase_ias38' THEN 'fair_value_gain'
    WHEN usage = 'revaluation_decrease_ias38' THEN 'fair_value_loss'
    WHEN usage = 'sale_ias38' AND amount > 0 THEN 'sale_profit'
    WHEN usage = 'sale_ias38' AND amount <= 0 THEN 'sale_loss'
    WHEN usage = 'sale_ias2' THEN 'sale_profit'
    ELSE usage
END
WHERE usage IS NOT NULL;

UPDATE public.exchange_trades 
SET usage = CASE 
    WHEN usage IN ('investment_acquisition_ias38', 'trading_acquisition_ias2') THEN 'cash_purchase'
    WHEN usage IN ('mining_rewards', 'staking_rewards') THEN 'staking_rewards'
    WHEN usage = 'impairment_ias38' THEN 'impairment_loss'
    WHEN usage = 'revaluation_increase_ias38' THEN 'fair_value_gain'
    WHEN usage = 'revaluation_decrease_ias38' THEN 'fair_value_loss'
    WHEN usage = 'sale_ias38' THEN 'sale_profit'
    WHEN usage = 'sale_ias2' THEN 'sale_profit'
    ELSE usage
END
WHERE usage IS NOT NULL;

-- 3. Redefine Profit & Loss View
DROP VIEW IF EXISTS public.v_profit_loss_statement;
CREATE VIEW public.v_profit_loss_statement AS
SELECT 
    user_id,
    entity_id,
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
    value_usd as balance_usd,
    value_jpy as balance_jpy,
    value_eur as balance_eur
FROM public.all_transactions
WHERE usage IS NOT NULL AND usage != 'cash_purchase';

-- 4. Redefine Balance Sheet View
DROP VIEW IF EXISTS public.v_balance_sheet;
CREATE VIEW public.v_balance_sheet AS
SELECT 
    user_id,
    entity_id,
    timezone('utc'::text, now()) as date,
    'Cryptocurrency Assets' as account,
    current_value_usd as balance_usd,
    current_value_jpy as balance_jpy,
    current_value_eur as balance_eur
FROM public.v_holdings;

-- 5. Redefine Cash Flow View
DROP VIEW IF EXISTS public.v_cash_flow_statement;
CREATE VIEW public.v_cash_flow_statement AS
-- Operating Adjustments
SELECT 
    user_id,
    entity_id,
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
    END as amount_usd,
    CASE 
        WHEN usage IN ('fair_value_gain', 'sale_profit', 'staking_rewards', 'payment_in_crypto') THEN -value_jpy 
        ELSE value_jpy 
    END as amount_jpy,
    CASE 
        WHEN usage IN ('fair_value_gain', 'sale_profit', 'staking_rewards', 'payment_in_crypto') THEN -value_eur 
        ELSE value_eur 
    END as amount_eur
FROM public.all_transactions
WHERE usage IN ('fair_value_gain', 'fair_value_loss', 'impairment_loss', 'sale_profit', 'sale_loss', 'staking_rewards', 'payment_in_crypto')

UNION ALL

-- Investing Activities
SELECT 
    user_id,
    entity_id,
    date,
    'Acquisition of Crypto Assets' as item,
    -value_usd as amount_usd,
    -value_jpy as amount_jpy,
    -value_eur as amount_eur
FROM public.all_transactions
WHERE usage = 'cash_purchase'

UNION ALL

SELECT 
    user_id,
    entity_id,
    date,
    'Proceeds from Sale of Crypto Assets' as item,
    value_usd as amount_usd,
    value_jpy as amount_jpy,
    value_eur as amount_eur
FROM public.all_transactions
WHERE usage IN ('sale_profit', 'sale_loss');
