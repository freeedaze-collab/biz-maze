-- Restore views accidentally dropped by CASCADE in previous migration.
-- Definitions taken from 20260110120000_definitive_multi_currency_fix.sql

-- =================================================================
-- VIEW: v_holdings (Multi-Currency Support)
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings WITH (security_invoker = true) AS
WITH
latest_rates AS (
    SELECT DISTINCT ON (target_currency)
        target_currency,
        rate
    FROM public.daily_exchange_rates
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
acquisitions AS (
    SELECT
        user_id,
        asset,
        sum(value_usd) AS total_cost_basis,
        sum(amount) AS total_amount_acquired
    FROM
        public.v_all_transactions_classified
    WHERE
        transaction_type = 'BUY' AND transaction_type <> 'INTERNAL_TRANSFER'
    GROUP BY
        user_id,
        asset
),
current_quantities AS (
    SELECT
        user_id,
        asset,
        sum(
            CASE
                WHEN transaction_type IN ('BUY', 'DEPOSIT', 'IN') THEN amount
                WHEN transaction_type IN ('SELL', 'WITHDRAWAL', 'OUT') THEN -amount
                ELSE 0
            END
        ) AS current_amount
    FROM
        public.v_all_transactions_classified
    WHERE
        transaction_type <> 'INTERNAL_TRANSFER'
    GROUP BY
        user_id,
        asset
)
SELECT
    cq.user_id,
    cq.asset,
    cq.current_amount,
    ap.current_price AS current_price, -- Aligned with UI
    (cq.current_amount * ap.current_price) AS current_value_usd, -- Aligned with UI
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY'), 1)) AS current_value_jpy,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR'), 1)) AS current_value_eur,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'GBP'), 1)) AS current_value_gbp,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'INR'), 1)) AS current_value_inr,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'SGD'), 1)) AS current_value_sgd,
    COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0) AS "avg_buy_price",
    (cq.current_amount * ap.current_price) - (cq.current_amount * COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0)) AS "unrealized_pnl",
    now() AS last_updated
FROM
    current_quantities cq
JOIN
    public.asset_prices ap ON cq.asset = ap.asset
LEFT JOIN
    acquisitions acq ON cq.user_id = acq.user_id AND cq.asset = acq.asset
WHERE
    cq.current_amount > 1e-9;

-- =================================================================
-- VIEW: v_profit_loss_statement (Multi-Currency)
-- =================================================================
CREATE OR REPLACE VIEW public.v_profit_loss_statement WITH (security_invoker = true) AS
WITH rates AS (
    SELECT target_currency, rate FROM (
        SELECT target_currency, rate, ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn
        FROM public.daily_exchange_rates WHERE source_currency = 'USD'
    ) AS r WHERE rn = 1
),
pnl_base AS (
    SELECT user_id, date, 'Sales Revenue (IAS 2)'::text AS account, value_usd AS balance FROM public.all_transactions WHERE usage = 'sale_ias2'
    UNION ALL
    SELECT user_id, date, 'Consideration Revenue (IFRS 15)'::text, value_usd FROM public.all_transactions WHERE usage = 'revenue_ifrs15'
    UNION ALL
    SELECT user_id, date, 'Staking & Mining Rewards'::text, value_usd FROM public.all_transactions WHERE usage = ANY (ARRAY['mining_rewards'::text, 'staking_rewards'::text])
    UNION ALL
    SELECT user_id, date, 'Cost of Goods Sold (IAS 2)'::text, -value_usd FROM public.all_transactions WHERE usage = 'sale_ias2'
    UNION ALL
    SELECT user_id, date, 'Unrealized Gains on Intangibles (Revaluation)'::text, value_usd FROM public.all_transactions WHERE usage = 'revaluation_increase_ias38'
    UNION ALL
    SELECT user_id, date, 'Unrealized Losses on Intangibles (Impairment)'::text, -value_usd FROM public.all_transactions WHERE usage = ANY (ARRAY['impairment_ias38'::text, 'revaluation_decrease_ias38'::text])
    UNION ALL
    SELECT user_id, date, 'Gas & Network Fees'::text, -value_usd FROM public.all_transactions WHERE usage = 'gas_fees'
)
SELECT
    user_id, date, account,
    SUM(balance) AS balance,
    SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY'), 1)) AS balance_jpy,
    SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR'), 1)) AS balance_eur,
    SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP'), 1)) AS balance_gbp,
    SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR'), 1)) AS balance_inr,
    SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD'), 1)) AS balance_sgd
FROM pnl_base
GROUP BY user_id, date, account;

-- =================================================================
-- VIEW: v_balance_sheet (Multi-Currency)
-- =================================================================
CREATE OR REPLACE VIEW public.v_balance_sheet WITH (security_invoker = true) AS
WITH rates AS (
    SELECT target_currency, rate FROM (
        SELECT target_currency, rate, ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn
        FROM public.daily_exchange_rates WHERE source_currency = 'USD'
    ) AS r WHERE rn = 1
),
movements AS (
    SELECT user_id, date, 'Inventory (Trading Crypto)'::text AS account, sum(value_usd) AS change FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2' GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Inventory (Trading Crypto)'::text, sum(-value_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'lcnrv_ias2'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Cash & Cash Equivalents'::text, sum(value_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias38'::text, 'sale_ias2'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Cash & Cash Equivalents'::text, sum(-value_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['investment_acquisition_ias38'::text, 'trading_acquisition_ias2'::text]) GROUP BY user_id, date
)
SELECT
    user_id, date, account,
    SUM(change) AS balance,
    SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY'), 1)) AS balance_jpy,
    SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR'), 1)) AS balance_eur,
    SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP'), 1)) AS balance_gbp,
    SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR'), 1)) AS balance_inr,
    SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD'), 1)) AS balance_sgd
FROM movements
GROUP BY user_id, date, account;

-- =================================================================
-- VIEW: v_cash_flow_statement (Multi-Currency)
-- =================================================================
CREATE OR REPLACE VIEW public.v_cash_flow_statement WITH (security_invoker = true) AS
WITH rates AS (
    SELECT target_currency, rate FROM (
        SELECT target_currency, rate, ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn
        FROM public.daily_exchange_rates WHERE source_currency = 'USD'
    ) AS r WHERE rn = 1
),
cf_base AS (
    SELECT user_id, date, 'Cash In from Sales'::text AS item, value_usd AS amount FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'sale_ias38'::text])
    UNION ALL
    SELECT user_id, date, 'Cash Out for Inventory'::text, -value_usd FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2'
    UNION ALL
    SELECT user_id, date, 'Cash Out for Gas Fees'::text, -value_usd FROM public.all_transactions WHERE usage = 'gas_fees'
    UNION ALL
    SELECT user_id, date, 'Cash Out for Intangibles'::text, -value_usd FROM public.all_transactions WHERE usage = 'investment_acquisition_ias38'
)
SELECT
    user_id, date, item,
    SUM(amount) AS amount,
    SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY'), 1)) AS amount_jpy,
    SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR'), 1)) AS amount_eur,
    SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP'), 1)) AS amount_gbp,
    SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR'), 1)) AS amount_inr,
    SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD'), 1)) AS amount_sgd
FROM cf_base
GROUP BY user_id, date, item;
