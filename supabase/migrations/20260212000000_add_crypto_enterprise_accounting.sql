-- Migration: Add Crypto Enterprise (IAS 2) vs Ordinary Enterprise (IAS 38) accounting
-- This adds company_type to entities and rebuilds financial statement views
-- to branch logic based on enterprise type.

-- =============================================================================
-- 1. Add company_type column to entities table
-- =============================================================================
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT 'ordinary';

-- Safe: only add constraint if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.entities ADD CONSTRAINT entities_company_type_check
    CHECK (company_type IN ('ordinary', 'crypto'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. Drop financial statement views (CASCADE not needed — they are leaf views)
-- =============================================================================
DROP VIEW IF EXISTS public.v_cash_flow_statement;
DROP VIEW IF EXISTS public.v_balance_sheet;
DROP VIEW IF EXISTS public.v_profit_loss_statement;

-- =============================================================================
-- 3. Recreate v_profit_loss_statement with company_type branching
-- =============================================================================
-- The view JOINs to entities to determine company_type.
-- Ordinary Enterprise (IAS 38): intangible asset model (impairment/revaluation)
-- Crypto Enterprise (IAS 2):    inventory model (FVLCTS, trading revenue)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_profit_loss_statement WITH (security_invoker = true) AS
WITH rates AS (
    SELECT target_currency, rate
    FROM (
        SELECT target_currency, rate,
               ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn
        FROM public.daily_exchange_rates
        WHERE source_currency = 'USD'
    ) AS r WHERE rn = 1
),
-- Ordinary Enterprise P/L (IAS 38): sale of intangible + impairment + revaluation
ordinary_pnl AS (
    SELECT t.user_id, t.entity_id, t.entity_name, t.date,
        CASE
            WHEN t.usage = 'sale_ias38' THEN 'Gain on Sale of Intangible Assets'
            WHEN t.usage IN ('mining_rewards', 'staking_rewards') THEN 'Staking & Mining Rewards'
            WHEN t.usage = 'revaluation_increase_ias38' THEN 'Revaluation Surplus (OCI → P/L on disposal)'
            WHEN t.usage = 'impairment_ias38' THEN 'Impairment Loss on Intangible Assets'
            WHEN t.usage = 'revaluation_decrease_ias38' THEN 'Revaluation Decrease (P/L)'
            WHEN t.usage = 'gas_fees' THEN 'Gas & Network Fees'
            WHEN t.usage = 'revenue_ifrs15' THEN 'Service Revenue (IFRS 15)'
            ELSE t.usage
        END AS account,
        CASE
            WHEN t.usage IN ('impairment_ias38', 'revaluation_decrease_ias38', 'gas_fees') THEN -t.value_usd
            ELSE t.value_usd
        END AS balance
    FROM public.all_transactions t
    JOIN public.entities e ON t.entity_id = e.id
    WHERE t.usage IS NOT NULL
      AND COALESCE(e.company_type, 'ordinary') = 'ordinary'
),
-- Crypto Enterprise P/L (IAS 2): trading revenue + FVLCTS + COGS
crypto_pnl AS (
    SELECT t.user_id, t.entity_id, t.entity_name, t.date,
        CASE
            WHEN t.usage = 'sale_ias2' THEN 'Trading Revenue'
            WHEN t.usage = 'trading_acquisition_ias2' THEN 'Cost of Goods Sold'
            WHEN t.usage = 'fv_change_ias2' THEN 'Fair Value Change (Unrealized)'
            WHEN t.usage = 'lcnrv_ias2' THEN 'Inventory Write-Down (LCNRV)'
            WHEN t.usage IN ('mining_rewards', 'staking_rewards') THEN 'Staking & Mining Rewards'
            WHEN t.usage = 'gas_fees' THEN 'Gas & Network Fees'
            WHEN t.usage = 'revenue_ifrs15' THEN 'Service Revenue (IFRS 15)'
            ELSE t.usage
        END AS account,
        CASE
            WHEN t.usage IN ('trading_acquisition_ias2', 'lcnrv_ias2', 'gas_fees') THEN -t.value_usd
            ELSE t.value_usd
        END AS balance
    FROM public.all_transactions t
    JOIN public.entities e ON t.entity_id = e.id
    WHERE t.usage IS NOT NULL
      AND e.company_type = 'crypto'
),
combined AS (
    SELECT * FROM ordinary_pnl
    UNION ALL
    SELECT * FROM crypto_pnl
)
SELECT
    c.user_id, c.entity_id, c.entity_name as entity, c.date, c.account,
    SUM(c.balance) AS balance,
    SUM(c.balance) AS balance_usd,
    SUM(c.balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY' LIMIT 1), 1)) AS balance_jpy,
    SUM(c.balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR' LIMIT 1), 1)) AS balance_eur,
    SUM(c.balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP' LIMIT 1), 1)) AS balance_gbp,
    SUM(c.balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR' LIMIT 1), 1)) AS balance_inr,
    SUM(c.balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD' LIMIT 1), 1)) AS balance_sgd
FROM combined c
GROUP BY c.user_id, c.entity_id, c.entity_name, c.date, c.account;

-- =============================================================================
-- 4. Recreate v_balance_sheet with company_type branching
-- =============================================================================
-- Ordinary Enterprise: Non-current Assets → Intangible Assets (cost − impairment)
-- Crypto Enterprise: Current Assets → Inventory (FVLCTS)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_balance_sheet WITH (security_invoker = true) AS
WITH rates AS (
    SELECT target_currency, rate
    FROM (
        SELECT target_currency, rate,
               ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn
        FROM public.daily_exchange_rates
        WHERE source_currency = 'USD'
    ) AS r WHERE rn = 1
),
-- Ordinary Enterprise B/S: Non-current intangible assets
ordinary_bs AS (
    SELECT t.user_id, t.entity_id, t.entity_name, t.date,
        CASE
            WHEN t.usage = 'investment_acquisition_ias38' THEN 'Intangible Assets (Crypto)'
            WHEN t.usage = 'sale_ias38' THEN 'Cash & Cash Equivalents'
            WHEN t.usage = 'impairment_ias38' THEN 'Intangible Assets (Crypto)'
            WHEN t.usage = 'revaluation_increase_ias38' THEN 'Intangible Assets (Crypto)'
            WHEN t.usage = 'revaluation_decrease_ias38' THEN 'Intangible Assets (Crypto)'
            ELSE NULL
        END AS account,
        CASE
            WHEN t.usage = 'investment_acquisition_ias38' THEN t.value_usd
            WHEN t.usage = 'sale_ias38' THEN t.value_usd
            WHEN t.usage = 'impairment_ias38' THEN -t.value_usd
            WHEN t.usage = 'revaluation_increase_ias38' THEN t.value_usd
            WHEN t.usage = 'revaluation_decrease_ias38' THEN -t.value_usd
            ELSE 0
        END AS change
    FROM public.all_transactions t
    JOIN public.entities e ON t.entity_id = e.id
    WHERE t.usage IS NOT NULL
      AND COALESCE(e.company_type, 'ordinary') = 'ordinary'
      AND t.usage IN ('investment_acquisition_ias38', 'sale_ias38', 'impairment_ias38',
                       'revaluation_increase_ias38', 'revaluation_decrease_ias38')
),
-- Crypto Enterprise B/S: Current inventory
crypto_bs AS (
    SELECT t.user_id, t.entity_id, t.entity_name, t.date,
        CASE
            WHEN t.usage = 'trading_acquisition_ias2' THEN 'Inventory (Trading Crypto)'
            WHEN t.usage = 'sale_ias2' THEN 'Cash & Cash Equivalents'
            WHEN t.usage = 'fv_change_ias2' THEN 'Inventory (Trading Crypto)'
            WHEN t.usage = 'lcnrv_ias2' THEN 'Inventory (Trading Crypto)'
            ELSE NULL
        END AS account,
        CASE
            WHEN t.usage = 'trading_acquisition_ias2' THEN t.value_usd
            WHEN t.usage = 'sale_ias2' THEN t.value_usd
            WHEN t.usage = 'fv_change_ias2' THEN t.value_usd
            WHEN t.usage = 'lcnrv_ias2' THEN -t.value_usd
            ELSE 0
        END AS change
    FROM public.all_transactions t
    JOIN public.entities e ON t.entity_id = e.id
    WHERE t.usage IS NOT NULL
      AND e.company_type = 'crypto'
      AND t.usage IN ('trading_acquisition_ias2', 'sale_ias2', 'fv_change_ias2', 'lcnrv_ias2')
),
-- Also include current holdings values from v_holdings for B/S snapshot
holdings_bs AS (
    SELECT h.user_id, h.entity_id, h.entity AS entity_name, now() AS date,
        CASE
            WHEN COALESCE(e.company_type, 'ordinary') = 'crypto' THEN 'Inventory (Trading Crypto)'
            ELSE 'Intangible Assets (Crypto)'
        END AS account,
        h.current_value_usd AS change
    FROM public.v_holdings h
    JOIN public.entities e ON h.entity_id = e.id
),
combined AS (
    SELECT * FROM ordinary_bs WHERE account IS NOT NULL
    UNION ALL
    SELECT * FROM crypto_bs WHERE account IS NOT NULL
    UNION ALL
    SELECT * FROM holdings_bs
)
SELECT
    c.user_id, c.entity_id, c.entity_name as entity, c.date, c.account,
    SUM(c.change) AS balance,
    SUM(c.change) AS balance_usd,
    SUM(c.change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY' LIMIT 1), 1)) AS balance_jpy,
    SUM(c.change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR' LIMIT 1), 1)) AS balance_eur,
    SUM(c.change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP' LIMIT 1), 1)) AS balance_gbp,
    SUM(c.change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR' LIMIT 1), 1)) AS balance_inr,
    SUM(c.change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD' LIMIT 1), 1)) AS balance_sgd
FROM combined c
GROUP BY c.user_id, c.entity_id, c.entity_name, c.date, c.account;

-- =============================================================================
-- 5. Recreate v_cash_flow_statement with company_type branching
-- =============================================================================
-- Ordinary Enterprise: Investing CF (acquisition/sale of intangibles)
-- Crypto Enterprise: Operating CF (trading inventory)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_cash_flow_statement WITH (security_invoker = true) AS
WITH rates AS (
    SELECT target_currency, rate
    FROM (
        SELECT target_currency, rate,
               ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn
        FROM public.daily_exchange_rates
        WHERE source_currency = 'USD'
    ) AS r WHERE rn = 1
),
-- Ordinary Enterprise C/F: Investing activities
ordinary_cf AS (
    SELECT t.user_id, t.entity_id, t.entity_name, t.date,
        CASE
            WHEN t.usage = 'sale_ias38' THEN 'Investing: Proceeds from Sale of Intangibles'
            WHEN t.usage = 'investment_acquisition_ias38' THEN 'Investing: Purchase of Intangible Assets'
            WHEN t.usage = 'gas_fees' THEN 'Operating: Gas & Network Fees'
            WHEN t.usage IN ('mining_rewards', 'staking_rewards') THEN 'Operating: Staking & Mining Inflow'
            ELSE NULL
        END AS item,
        CASE
            WHEN t.usage IN ('investment_acquisition_ias38', 'gas_fees') THEN -t.value_usd
            ELSE t.value_usd
        END AS amount
    FROM public.all_transactions t
    JOIN public.entities e ON t.entity_id = e.id
    WHERE t.usage IS NOT NULL
      AND COALESCE(e.company_type, 'ordinary') = 'ordinary'
      AND t.usage IN ('sale_ias38', 'investment_acquisition_ias38', 'gas_fees',
                       'mining_rewards', 'staking_rewards')
),
-- Crypto Enterprise C/F: Operating activities (trading is core business)
crypto_cf AS (
    SELECT t.user_id, t.entity_id, t.entity_name, t.date,
        CASE
            WHEN t.usage = 'sale_ias2' THEN 'Operating: Cash In from Trading Sales'
            WHEN t.usage = 'trading_acquisition_ias2' THEN 'Operating: Cash Out for Inventory Purchase'
            WHEN t.usage = 'gas_fees' THEN 'Operating: Gas & Network Fees'
            WHEN t.usage IN ('mining_rewards', 'staking_rewards') THEN 'Operating: Staking & Mining Inflow'
            WHEN t.usage = 'revenue_ifrs15' THEN 'Operating: Service Revenue'
            ELSE NULL
        END AS item,
        CASE
            WHEN t.usage IN ('trading_acquisition_ias2', 'gas_fees') THEN -t.value_usd
            ELSE t.value_usd
        END AS amount
    FROM public.all_transactions t
    JOIN public.entities e ON t.entity_id = e.id
    WHERE t.usage IS NOT NULL
      AND e.company_type = 'crypto'
      AND t.usage IN ('sale_ias2', 'trading_acquisition_ias2', 'gas_fees',
                       'mining_rewards', 'staking_rewards', 'revenue_ifrs15')
),
combined AS (
    SELECT * FROM ordinary_cf WHERE item IS NOT NULL
    UNION ALL
    SELECT * FROM crypto_cf WHERE item IS NOT NULL
)
SELECT
    c.user_id, c.entity_id, c.entity_name as entity, c.date, c.item,
    SUM(c.amount) AS amount,
    SUM(c.amount) AS amount_usd,
    SUM(c.amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY' LIMIT 1), 1)) AS amount_jpy,
    SUM(c.amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR' LIMIT 1), 1)) AS amount_eur,
    SUM(c.amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP' LIMIT 1), 1)) AS amount_gbp,
    SUM(c.amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR' LIMIT 1), 1)) AS amount_inr,
    SUM(c.amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD' LIMIT 1), 1)) AS amount_sgd
FROM combined c
GROUP BY c.user_id, c.entity_id, c.entity_name, c.date, c.item;

-- =============================================================================
-- 6. Re-grant permissions
-- =============================================================================
GRANT SELECT ON public.v_profit_loss_statement TO authenticated, service_role;
GRANT SELECT ON public.v_balance_sheet TO authenticated, service_role;
GRANT SELECT ON public.v_cash_flow_statement TO authenticated, service_role;
