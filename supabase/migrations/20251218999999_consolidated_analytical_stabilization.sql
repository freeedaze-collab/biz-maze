-- supabase/migrations/20251218999999_consolidated_analytical_stabilization.sql
-- PURPOSE: Unified source of truth for all analytical views with multi-currency support.
-- Renames value_in_usd to value_usd for UI compatibility.

-- Drop dependent views to allow full re-definition
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions CASCADE;

-- =================================================================
-- VIEW: all_transactions (DEFINITIVE VERSION)
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions AS
WITH
-- Fetch latest exchange rates once for all columns
rates AS (
    SELECT DISTINCT ON (target_currency)
        target_currency,
        rate
    FROM public.daily_exchange_rates
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
-- 1. On-chain unified source
onchain_base AS (
  SELECT
    t.id::text as id,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset,
    NULL::text AS quote_asset,
    NULL::numeric AS price,
    t.direction AS type,
    'on-chain' as source,
    t.chain_id::text AS chain,
    t.wallet_address,
    NULL::text AS connection_name,
    COALESCE(t.usd_value_at_tx, 0) AS value_usd, -- Renamed for UI
    ul.usage_key AS usage,
    t.raw->>'note' as note
  FROM public.wallet_transactions t
  LEFT JOIN public.transaction_usage_labels ul ON ul.tx_id = t.id
),
-- 2. Exchange unified source
exchange_base AS (
  SELECT
    et.trade_id::text as id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    CASE
        WHEN et.side = 'buy' THEN et.amount
        WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price
        ELSE et.amount
    END AS amount,
    split_part(et.symbol, '/', 1) AS asset,
    split_part(et.symbol, '/', 2) AS quote_asset,
    et.price,
    et.side AS type,
    'exchange' as source,
    et.exchange AS chain,
    NULL::text AS wallet_address,
    ec.connection_name,
    COALESCE(et.value_usd, 0) AS value_usd, -- Renamed for UI
    ul.usage_key AS usage,
    et.raw_data->>'note' as note
  FROM public.exchange_trades et
  LEFT JOIN public.exchange_connections ec ON et.exchange_connection_id = ec.id
  LEFT JOIN public.transaction_usage_labels ul ON ul.ctx_id = et.trade_id
),
unified_base AS (
    SELECT * FROM onchain_base
    UNION ALL
    SELECT * FROM exchange_base
)
SELECT 
    b.*,
    (b.value_usd * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY'), 1)) AS value_jpy,
    (b.value_usd * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR'), 1)) AS value_eur,
    (b.value_usd * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP'), 1)) AS value_gbp,
    (b.value_usd * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR'), 1)) AS value_inr,
    (b.value_usd * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD'), 1)) AS value_sgd
FROM unified_base b;

-- =================================================================
-- VIEW: internal_transfer_pairs
-- =================================================================
CREATE OR REPLACE VIEW public.internal_transfer_pairs AS
SELECT
    tx_out.user_id,
    tx_out.id AS withdrawal_id,
    tx_in.id AS deposit_id
FROM
    public.all_transactions tx_out
JOIN
    public.all_transactions tx_in
    ON tx_out.user_id = tx_in.user_id
    AND tx_out.asset = tx_in.asset
    AND (tx_out.type ILIKE 'withdraw%' OR tx_out.type = 'send' OR tx_out.type = 'out')
    AND (tx_in.type ILIKE 'deposit%' OR tx_in.type = 'receive' OR tx_in.type = 'in')
    AND tx_in.amount BETWEEN (tx_out.amount * 0.99) AND (tx_out.amount * 1.01)
    AND tx_in.date >= tx_out.date
    AND tx_in.date <= (tx_out.date + INTERVAL '24 hours')
    AND COALESCE(tx_out.connection_name, tx_out.wallet_address) <> COALESCE(tx_in.connection_name, tx_in.wallet_address);

-- =================================================================
-- VIEW: v_all_transactions_classified
-- =================================================================
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
WITH all_internal_ids AS (
    SELECT withdrawal_id AS id FROM public.internal_transfer_pairs
    UNION
    SELECT deposit_id AS id FROM public.internal_transfer_pairs
)
SELECT
    t.*,
    CASE
        WHEN ai.id IS NOT NULL THEN 'INTERNAL_TRANSFER'
        WHEN t.usage IS NOT NULL THEN UPPER(t.usage)
        WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
        WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' OR t.type = 'in' THEN 'DEPOSIT'
        WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' OR t.type = 'out' THEN 'WITHDRAWAL'
        ELSE 'OTHER'
    END as transaction_type
FROM
    public.all_transactions t
LEFT JOIN
    all_internal_ids ai ON t.id = ai.id;

-- =================================================================
-- VIEW: v_holdings (Multi-Currency Support)
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS
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
CREATE OR REPLACE VIEW public.v_profit_loss_statement AS
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
CREATE OR REPLACE VIEW public.v_balance_sheet AS
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
CREATE OR REPLACE VIEW public.v_cash_flow_statement AS
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
