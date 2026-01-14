-- Migration: Add Entity Information to Financial Views (Improved with DROP)
-- 
-- Adds entity_id and entity_name (as entity) to:
-- - v_holdings
-- - v_profit_loss_statement
-- - v_balance_sheet
-- - v_cash_flow_statement

-- Step 1: Drop views in depedency order
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;
DROP VIEW IF EXISTS public.v_holdings CASCADE;

-- Step 2: Recreate v_holdings (Add entity_name)
CREATE OR REPLACE VIEW public.v_holdings AS
WITH latest_rates AS (
    SELECT DISTINCT ON (target_currency)
        target_currency,
        rate
    FROM public.daily_exchange_rates
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
current_quantities AS (
    SELECT
        user_id,
        entity_id,
        entity_name,
        asset,
        sum(
            CASE
                WHEN UPPER(type) IN ('IN', 'DEPOSIT', 'BUY', 'RECEIVE') THEN amount
                WHEN UPPER(type) IN ('OUT', 'WITHDRAWAL', 'SELL', 'SEND') THEN -amount
                ELSE 0
            END
        ) AS current_amount
    FROM
        public.v_all_transactions_classified
    WHERE
        transaction_type <> 'INTERNAL_TRANSFER'
    GROUP BY
        user_id,
        entity_id,
        entity_name,
        asset
)
SELECT 
    cq.user_id,
    cq.entity_id,
    cq.entity_name as entity,
    cq.asset,
    cq.current_amount,
    COALESCE(ap.current_price, 0) AS current_price,
    (cq.current_amount * COALESCE(ap.current_price, 0)) AS current_value_usd,
    (cq.current_amount * COALESCE(ap.current_price, 0) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY'), 1)) AS current_value_jpy,
    (cq.current_amount * COALESCE(ap.current_price, 0) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR'), 1)) AS current_value_eur,
    now() AS last_updated
FROM current_quantities cq
LEFT JOIN public.asset_prices ap ON TRIM(UPPER(cq.asset)) = TRIM(UPPER(ap.asset))
WHERE cq.current_amount > 1e-9;

-- Step 3: Recreate v_profit_loss_statement (using v_all_transactions_classified for transaction_type)
CREATE OR REPLACE VIEW public.v_profit_loss_statement AS
SELECT
    user_id,
    entity_id,
    entity_name as entity,
    date,
    CASE
        WHEN usage = 'sale_ias2' THEN 'Sales Revenue (IAS 2)'
        WHEN usage = 'revenue_ifrs15' THEN 'Consideration Revenue (IFRS 15)'
        WHEN usage = 'trading_acquisition_ias2' THEN 'Cost of Goods Sold (IAS 2)'
        WHEN usage = 'mining_rewards' THEN 'Staking & Mining Rewards'
        WHEN usage = 'staking_rewards' THEN 'Staking & Mining Rewards'
        WHEN usage = 'gas_fees' THEN 'Gas & Network Fees'
        WHEN usage = 'loss_unrecoverable' THEN 'Loss of Crypto (Unrecoverable)'
        WHEN usage = 'revaluation_increase_ias38' THEN 'Unrealized Gains on Intangibles (Revaluation)'
        WHEN usage = 'revaluation_decrease_ias38' THEN 'Unrealized Losses on Intangibles (Impairment)'
        WHEN usage = 'impairment_ias38' THEN 'Unrealized Losses on Intangibles (Impairment)'
        WHEN usage = 'sale_ias38' THEN 'Realized Gains on Intangibles (Sale)'
        ELSE usage
    END AS account,
    value_usd AS amount_usd,
    value_jpy AS amount_jpy,
    value_eur AS amount_eur,
    CASE 
        WHEN usage IN ('sale_ias2', 'revenue_ifrs15', 'mining_rewards', 'staking_rewards', 'revaluation_increase_ias38', 'sale_ias38') THEN value_usd
        ELSE -value_usd
    END AS balance,
    CASE 
        WHEN usage IN ('sale_ias2', 'revenue_ifrs15', 'mining_rewards', 'staking_rewards', 'revaluation_increase_ias38', 'sale_ias38') THEN value_usd
        ELSE -value_usd
    END AS balance_usd,
    CASE 
        WHEN usage IN ('sale_ias2', 'revenue_ifrs15', 'mining_rewards', 'staking_rewards', 'revaluation_increase_ias38', 'sale_ias38') THEN value_jpy
        ELSE -value_jpy
    END AS balance_jpy,
    CASE 
        WHEN usage IN ('sale_ias2', 'revenue_ifrs15', 'mining_rewards', 'staking_rewards', 'revaluation_increase_ias38', 'sale_ias38') THEN value_eur
        ELSE -value_eur
    END AS balance_eur
FROM v_all_transactions_classified
WHERE usage IS NOT NULL AND transaction_type != 'INTERNAL_TRANSFER';

-- Step 4: Recreate v_balance_sheet
CREATE OR REPLACE VIEW public.v_balance_sheet AS
SELECT
    user_id,
    entity_id,
    entity as entity_name,
    timezone('utc', now()) AS date,
    'Inventory (Trading Crypto)' AS account,
    current_value_usd AS balance,
    current_value_usd AS balance_usd,
    current_value_jpy AS balance_jpy,
    current_value_eur AS balance_eur
FROM v_holdings;

-- Step 5: Recreate v_cash_flow_statement
CREATE OR REPLACE VIEW public.v_cash_flow_statement AS
SELECT
    user_id,
    entity_id,
    entity_name as entity,
    date,
    CASE
        WHEN usage = 'sale_ias2' OR usage = 'revenue_ifrs15' THEN 'Inflow from Sales (IAS 2 & IFRS 15)'
        WHEN usage = 'trading_acquisition_ias2' THEN 'Outflow for Inventory (IAS 2)'
        WHEN usage = 'gas_fees' THEN 'Outflow for Gas Fees'
        WHEN usage = 'investment_acquisition_ias38' THEN 'Outflow for Intangible Assets'
        WHEN usage = 'sale_ias38' THEN 'Inflow from Sale of Intangibles'
        ELSE usage
    END AS item,
    value_usd AS amount,
    value_usd AS amount_usd,
    value_jpy AS amount_jpy,
    value_eur AS amount_eur
FROM all_transactions
WHERE usage IS NOT NULL;

-- Step 6: Grant permissions again
GRANT SELECT ON public.v_holdings TO authenticated, service_role;
GRANT SELECT ON public.v_profit_loss_statement TO authenticated, service_role;
GRANT SELECT ON public.v_balance_sheet TO authenticated, service_role;
GRANT SELECT ON public.v_cash_flow_statement TO authenticated, service_role;
