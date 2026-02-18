-- Migration: Unify Legacy and New Sync Schema in Views
-- This migration updates the all_transactions view to support both Moralis (wei-based) and Etherscan (amount-based) records.

DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- =================================================================
-- VIEW: all_transactions (UNIFIED SCHEMA VERSION)
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions WITH (security_invoker = true) AS
WITH
latest_rates AS (
    SELECT DISTINCT ON (target_currency)
        target_currency,
        rate
    FROM public.daily_exchange_rates
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
onchain_base AS (
  SELECT
    t.id::text as id,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    -- Enhanced description
    'On-chain: ' || COALESCE(t.type, t.direction) || ' ' || COALESCE(t.asset, t.asset_symbol, 'ETH') AS description,
    -- Amount: Support both direct amount and wei-based calc
    COALESCE(t.amount, (t.value_wei / 1e18), 0) AS amount,
    -- Asset: Support both columns
    COALESCE(t.asset, t.asset_symbol, 'ETH') AS asset,
    NULL::text AS quote_asset,
    der.rate AS price, 
    -- Type: Support both columns
    COALESCE(t.type, t.direction) AS type,
    'on-chain' as source,
    t.chain_id::text AS chain,
    t.wallet_address,
    NULL::text AS connection_name,
    -- Value USD: Prioritize stored value, then dynamic calc using the unified asset/amount
    COALESCE(
        t.fiat_value_usd, 
        t.value_in_usd, 
        (COALESCE(t.amount, (t.value_wei / 1e18), 0) * der.rate), 
        0
    ) AS value_usd,
    COALESCE(t.usage, ul.usage_key) AS usage,
    (t.raw->>'note')::text as note
  FROM public.wallet_transactions t
  LEFT JOIN public.transaction_usage_labels ul ON ul.tx_id = t.id
  -- Robust JOIN for Price Lookup
  LEFT JOIN public.daily_exchange_rates der 
    ON t.timestamp::date = der.date 
    AND UPPER(COALESCE(t.asset, t.asset_symbol, 'ETH')) = UPPER(der.source_currency)
    AND der.target_currency = 'USD'
),
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
    COALESCE(et.value_usd, 0) AS value_usd, 
    COALESCE(et.usage, ul.usage_key) AS usage,
    (et.raw_data->>'note')::text as note
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
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY'), 1)) AS value_jpy,
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR'), 1)) AS value_eur,
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'GBP'), 1)) AS value_gbp,
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'INR'), 1)) AS value_inr,
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'SGD'), 1)) AS value_sgd
FROM unified_base b;

-- =================================================================
-- Recreate Dependent Views
-- =================================================================

CREATE OR REPLACE VIEW public.internal_transfer_pairs WITH (security_invoker = true) AS
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

CREATE OR REPLACE VIEW public.v_all_transactions_classified WITH (security_invoker = true) AS
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
        WHEN UPPER(t.type) IN ('BUY', 'DEPOSIT', 'IN', 'RECEIVE') THEN 'DEPOSIT'
        WHEN UPPER(t.type) IN ('SELL', 'WITHDRAWAL', 'OUT', 'SEND') THEN 'WITHDRAWAL'
        ELSE 'OTHER'
    END as transaction_type
FROM
    public.all_transactions t
LEFT JOIN
    all_internal_ids ai ON t.id = ai.id;

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
        (transaction_type = 'BUY' OR usage IN ('mining_rewards', 'staking_rewards', 'airdrop', 'income'))
        AND transaction_type <> 'INTERNAL_TRANSFER'
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
        asset
)
SELECT
    cq.user_id,
    cq.asset,
    cq.current_amount,
    ap.current_price AS current_price,
    (cq.current_amount * ap.current_price) AS current_value_usd,
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
    public.asset_prices ap ON TRIM(UPPER(cq.asset)) = TRIM(UPPER(ap.asset))
LEFT JOIN
    acquisitions acq ON cq.user_id = acq.user_id AND cq.asset = acq.asset
WHERE
    cq.current_amount > 1e-9;

-- Grant Permissions
GRANT ALL ON public.all_transactions TO authenticated, service_role;
GRANT ALL ON public.v_all_transactions_classified TO authenticated, service_role;
GRANT ALL ON public.v_holdings TO authenticated, service_role;
