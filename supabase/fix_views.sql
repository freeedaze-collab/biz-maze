-- FINAL Restoration (Fixed entity_id and value_usd types)
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

CREATE OR REPLACE VIEW public.all_transactions WITH (security_invoker = true) AS
WITH latest_rates AS (
    SELECT DISTINCT ON (target_currency) target_currency, rate FROM public.daily_exchange_rates 
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
raw_base AS (
  (
    SELECT DISTINCT ON (t.tx_hash, t.user_id, public.normalize_crypto_asset(COALESCE(t.asset, t.asset_symbol, 'ETH')), t.amount, COALESCE(t.type, t.direction))
      t.id::text as id, t.user_id, t.tx_hash AS reference_id, t.timestamp AS date,
      'On-chain: ' || COALESCE(t.type, t.direction) || ' ' || COALESCE(t.asset, t.asset_symbol, 'ETH') AS description,
      CASE 
        WHEN (COALESCE(t.type, t.direction) ILIKE 'withdraw%' OR COALESCE(t.type, t.direction) IN ('send', 'out')) 
        THEN -COALESCE(t.amount, (t.value_wei / 1e18), 0)::numeric
        ELSE COALESCE(t.amount, (t.value_wei / 1e18), 0)::numeric
      END AS amount,
      COALESCE(t.asset, t.asset_symbol, 'ETH') AS raw_asset,
      NULL::text AS quote_asset, 0.0::double precision as raw_price,
      COALESCE(t.type, t.direction) AS type, 'on-chain' as source, t.chain_id::text AS chain, t.wallet_address,
      NULL::text AS connection_name,
      COALESCE(CAST(t.historical_price_unit AS numeric) * COALESCE(t.amount, (t.value_wei / 1e18), 0)::numeric, t.value_in_usd::numeric, 0) AS value_usd,
      COALESCE(t.usage, ul.usage_key) AS usage, (t.raw->>'note')::text as note, wc.entity_id, e.name as entity_name
    FROM public.wallet_transactions t
    LEFT JOIN public.wallet_connections wc ON t.wallet_address = wc.wallet_address AND t.user_id = wc.user_id
    LEFT JOIN public.entities e ON wc.entity_id = e.id
    LEFT JOIN public.transaction_usage_labels ul ON ul.tx_id = t.id
    ORDER BY t.tx_hash, t.user_id, public.normalize_crypto_asset(COALESCE(t.asset, t.asset_symbol, 'ETH')), t.amount, COALESCE(t.type, t.direction), t.timestamp DESC
  )
  UNION ALL
  SELECT
    m.id, et.user_id, et.trade_id::text AS reference_id, et.ts AS date,
    m.description, m.amount, m.asset AS raw_asset, m.quote_asset, et.price as raw_price, m.type, 
    'exchange' as source, et.exchange AS chain, NULL::text AS wallet_address,
    ec.connection_name, 
    CASE WHEN m.is_base THEN COALESCE(et.value_usd, 0)::numeric ELSE (m.amount * COALESCE((SELECT rate FROM public.daily_exchange_rates WHERE source_currency = m.asset AND target_currency = 'USD' AND date <= et.ts::date ORDER BY date DESC LIMIT 1), 1.0)) END::numeric AS value_usd,
    COALESCE(et.usage, ul.usage_key) AS usage, (et.raw_data->>'note')::text as note,
    ec.entity_id, e.name as entity_name
  FROM public.exchange_trades et
  LEFT JOIN public.exchange_connections ec ON et.exchange_connection_id = ec.id
  LEFT JOIN public.entities e ON ec.entity_id = e.id
  LEFT JOIN public.transaction_usage_labels ul ON ul.ctx_id = et.trade_id::text
  CROSS JOIN LATERAL (
    SELECT 
      et.id::text || '-base' as id, true as is_base,
      'Exchange: ' || et.side || ' ' || et.symbol AS description,
      CASE 
        WHEN et.side = 'buy' THEN et.amount
        WHEN et.side = 'sell' THEN -(et.amount / NULLIF(et.price, 0))
        WHEN et.side IN ('deposit', 'earn_redeem') THEN et.amount
        WHEN et.side IN ('withdrawal', 'earn_subscribe') THEN -et.amount
        ELSE et.amount 
      END::numeric AS amount,
      CASE WHEN position('/' in et.symbol) > 0 THEN split_part(et.symbol, '/', 1) ELSE et.symbol END AS asset,
      CASE WHEN position('/' in et.symbol) > 0 THEN split_part(et.symbol, '/', 2) ELSE NULL::text END AS quote_asset,
      CASE WHEN et.side = 'buy' THEN 'buy' WHEN et.side = 'sell' THEN 'sell' WHEN et.side = 'earn_subscribe' THEN 'withdrawal' WHEN et.side = 'earn_redeem' THEN 'deposit' ELSE et.side END AS type
    UNION ALL
    SELECT
      et.id::text || '-quote', false,
      'Exchange (Quote): ' || split_part(et.symbol, '/', 2),
      CASE WHEN et.side = 'buy' THEN -(et.amount * et.price) WHEN et.side = 'sell' THEN et.amount ELSE NULL END::numeric,
      split_part(et.symbol, '/', 2), NULL::text,
      CASE WHEN et.side = 'buy' THEN 'withdrawal' WHEN et.side = 'sell' THEN 'deposit' ELSE NULL END
    WHERE position('/' in et.symbol) > 0 AND (et.side = 'buy' OR et.side = 'sell')
  ) m
),
normalized_base AS (
  SELECT r.*, public.normalize_crypto_asset(raw_asset) as normalized_asset_name
  FROM raw_base r
  WHERE 
    (source = 'exchange' OR UPPER(TRIM(raw_asset)) = public.normalize_crypto_asset(raw_asset))
    AND public.normalize_crypto_asset(raw_asset) !~* '\\.com|\\.org|\\.xyz|\\.gift|http|Visit to|claim|reward|airdrop|Invitation|#|\\$|erc20|lp-token'
    AND public.normalize_crypto_asset(raw_asset) NOT IN ('USD', 'JPY', 'EUR', 'GBP')
)
SELECT 
    id, user_id, reference_id, date, description, amount, raw_asset as raw_asset_name, normalized_asset_name as asset,
    quote_asset, price, type, source, chain, wallet_address, connection_name,
    (ABS(value_usd) * SIGN(amount))::numeric AS value_usd,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY' LIMIT 1), 1))::numeric AS value_jpy,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR' LIMIT 1), 1))::numeric AS value_eur,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'GBP' LIMIT 1), 1))::numeric AS value_gbp,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'INR' LIMIT 1), 1))::numeric AS value_inr,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'SGD' LIMIT 1), 1))::numeric AS value_sgd,
    usage, note, entity_id, entity_name
FROM normalized_base;

CREATE OR REPLACE VIEW public.internal_transfer_pairs WITH (security_invoker = true) AS
SELECT tx_out.user_id, tx_out.id AS withdrawal_id, tx_in.id AS deposit_id
FROM public.all_transactions tx_out 
JOIN public.all_transactions tx_in ON tx_out.user_id = tx_in.user_id AND tx_out.asset = tx_in.asset
AND (tx_out.type ILIKE 'withdraw%' OR tx_out.type = 'send' OR tx_out.type = 'out')
AND (tx_in.type ILIKE 'deposit%' OR tx_in.type = 'receive' OR tx_in.type = 'in')
AND ABS(tx_in.amount) BETWEEN (ABS(tx_out.amount) * 0.99) AND (ABS(tx_out.amount) * 1.01)
AND tx_in.date >= tx_out.date AND tx_in.date <= (tx_out.date + INTERVAL '24 hours')
AND COALESCE(tx_out.connection_name, tx_out.wallet_address) <> COALESCE(tx_in.connection_name, tx_in.wallet_address);

CREATE OR REPLACE VIEW public.v_all_transactions_classified WITH (security_invoker = true) AS
WITH all_internal_ids AS ( SELECT withdrawal_id AS id FROM public.internal_transfer_pairs UNION SELECT deposit_id AS id FROM public.internal_transfer_pairs )
SELECT t.*, CASE WHEN ai.id IS NOT NULL THEN 'INTERNAL_TRANSFER' 
WHEN t.usage IS NOT NULL THEN UPPER(t.usage) WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
WHEN UPPER(t.type) IN ('BUY', 'DEPOSIT', 'IN', 'RECEIVE', 'EARN_REDEEM') THEN 'DEPOSIT' 
WHEN UPPER(t.type) IN ('SELL', 'WITHDRAWAL', 'OUT', 'SEND', 'EARN_SUBSCRIBE') THEN 'WITHDRAWAL' ELSE 'OTHER' END as transaction_type
FROM public.all_transactions t LEFT JOIN all_internal_ids ai ON t.id = ai.id;

CREATE OR REPLACE VIEW public.v_holdings WITH (security_invoker = true) AS
WITH latest_rates AS ( 
    SELECT DISTINCT ON (target_currency) target_currency, rate FROM public.daily_exchange_rates 
    WHERE source_currency = 'USD' ORDER BY target_currency, date DESC 
),
acquisitions AS (
    SELECT user_id, entity_id, asset, sum(value_usd) AS total_cost_basis, sum(amount) AS total_amount_acquired
    FROM public.v_all_transactions_classified
    WHERE (transaction_type = 'BUY' OR usage IN ('mining_rewards', 'staking_rewards', 'airdrop', 'income')) 
    AND transaction_type <> 'INTERNAL_TRANSFER' AND amount > 0
    GROUP BY user_id, entity_id, asset
),
current_quantities AS (
    SELECT user_id, entity_id, entity_name, asset, sum(amount) AS current_amount
    FROM public.v_all_transactions_classified GROUP BY user_id, entity_id, entity_name, asset
)
SELECT 
    cq.user_id, cq.entity_id, cq.entity_name as entity, cq.asset, cq.current_amount, 
    COALESCE(ap.current_price, 0) AS current_price, (cq.current_amount * COALESCE(ap.current_price, 0))::numeric AS current_value_usd,
    (cq.current_amount * COALESCE(ap.current_price, 0) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY' LIMIT 1), 1))::numeric AS current_value_jpy,
    (cq.current_amount * COALESCE(ap.current_price, 0) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR' LIMIT 1), 1))::numeric AS current_value_eur,
    (cq.current_amount * COALESCE(ap.current_price, 0) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'GBP' LIMIT 1), 1))::numeric AS current_value_gbp,
    (cq.current_amount * COALESCE(ap.current_price, 0) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'INR' LIMIT 1), 1))::numeric AS current_value_inr,
    (cq.current_amount * COALESCE(ap.current_price, 0) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'SGD' LIMIT 1), 1))::numeric AS current_value_sgd,
    COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0)::numeric AS avg_buy_price,
    ((cq.current_amount * COALESCE(ap.current_price, 0)) - (cq.current_amount * COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0)))::numeric AS unrealized_pnl, 
    now() AS last_updated
FROM current_quantities cq 
LEFT JOIN public.asset_prices ap ON cq.asset = ap.asset 
LEFT JOIN acquisitions acq ON cq.user_id = acq.user_id AND cq.entity_id = acq.entity_id AND cq.asset = acq.asset
WHERE ROUND(cq.current_amount::numeric, 10) != 0;

CREATE OR REPLACE VIEW public.v_profit_loss_statement WITH (security_invoker = true) AS
WITH rates AS ( SELECT target_currency, rate FROM (SELECT target_currency, rate, ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn FROM public.daily_exchange_rates WHERE source_currency = 'USD') AS r WHERE rn = 1 )
SELECT p.*, (p.balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY' LIMIT 1), 1))::numeric AS balance_jpy FROM (
    SELECT user_id, entity_id, entity_name, date, 'Sales Revenue (IAS 2)'::text AS account, value_usd AS balance FROM public.all_transactions WHERE usage = 'sale_ias2'
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Consideration Revenue (IFRS 15)'::text, value_usd FROM public.all_transactions WHERE usage = 'revenue_ifrs15'
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Staking & Mining Rewards'::text, value_usd FROM public.all_transactions WHERE usage = ANY (ARRAY['mining_rewards'::text, 'staking_rewards'::text])
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cost of Goods Sold (IAS 2)'::text, -value_usd FROM public.all_transactions WHERE usage = 'sale_ias2'
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Unrealized Gains on Intangibles (Revaluation)'::text, value_usd FROM public.all_transactions WHERE usage = 'revaluation_increase_ias38'
) p;

CREATE OR REPLACE VIEW public.v_cash_flow_statement WITH (security_invoker = true) AS
WITH rates AS ( SELECT target_currency, rate FROM (SELECT target_currency, rate, ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn FROM public.daily_exchange_rates WHERE source_currency = 'USD') AS r WHERE rn = 1 )
SELECT user_id, entity_id, entity_name, date, 'Operating Cash Flow'::text AS category, asset, amount, value_usd, (value_usd * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY' LIMIT 1), 1))::numeric AS value_jpy
FROM public.v_all_transactions_classified WHERE transaction_type <> 'INTERNAL_TRANSFER';

CREATE OR REPLACE VIEW public.v_balance_sheet WITH (security_invoker = true) AS
SELECT * FROM public.v_holdings;

GRANT SELECT ON public.all_transactions TO authenticated, service_role;
GRANT SELECT ON public.v_all_transactions_classified TO authenticated, service_role;
GRANT SELECT ON public.v_holdings TO authenticated, service_role;
GRANT SELECT ON public.v_profit_loss_statement TO authenticated, service_role;
GRANT SELECT ON public.v_balance_sheet TO authenticated, service_role;
GRANT SELECT ON public.v_cash_flow_statement TO authenticated, service_role;
