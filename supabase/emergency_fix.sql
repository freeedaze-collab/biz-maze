-- EMERGENCY DIRECT FIX: Recreates all views without relying on CLI migration history.
-- This script ensures v_holdings.entity_id exists in production.

-- 1. DROP ALL VIEWS
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- 2. Normalization Function
CREATE OR REPLACE FUNCTION public.normalize_crypto_asset(p_asset text) 
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE 
    WHEN TRIM(p_asset) ~* '^[UＵ][SЅ][D𝐃][CС]$|USDС|UЅDC|𝐔𝐒𝐃𝐂|UЅDС' THEN 'USDC'
    WHEN TRIM(p_asset) ~* '^[E𝐄][TＴ][HＨ]$|ЕTH|ÈTH' THEN 'ETH'
    WHEN TRIM(p_asset) ~* '^[BＢ][TＴ][CＣ]$|ВTC' THEN 'BTC'
    WHEN TRIM(p_asset) ~* '^[D𝐃][A𝐀][IＩ]$' THEN 'DAI'
    WHEN TRIM(p_asset) ~* '^[UＵ][SЅ][D𝐃][TＴ]$' THEN 'USDT'
    WHEN TRIM(p_asset) ~* '^ЕRC20$|^ERC20$' THEN 'ERC20'
    ELSE TRIM(UPPER(p_asset))
  END;
$$;

-- 3. Base Layer: all_transactions
CREATE OR REPLACE VIEW public.all_transactions WITH (security_invoker = true) AS
WITH latest_rates AS (
    SELECT DISTINCT ON (target_currency) target_currency, rate FROM public.daily_exchange_rates 
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
onchain_raw AS (
  -- First normalize, then distinct
  SELECT DISTINCT ON (tx_hash, user_id, normalized_asset, raw_amount, type_direction)
    *
  FROM (
      SELECT 
        t.id::text as id, t.user_id, t.tx_hash, t.timestamp AS date,
        public.normalize_crypto_asset(COALESCE(t.asset, t.asset_symbol, 'ETH')) as normalized_asset,
        COALESCE(t.amount, (t.value_wei / 1e18), 0)::numeric as raw_amount,
        COALESCE(t.type, t.direction) as type_direction,
        COALESCE(t.asset, t.asset_symbol, 'ETH') AS raw_asset,
        t.chain_id::text AS chain, t.wallet_address,
        COALESCE(t.price_usd::numeric * COALESCE(t.amount, (t.value_wei / 1e18), 0)::numeric, t.value_in_usd::numeric, 0::numeric) AS value_usd,
        COALESCE(t.usage, ul.usage_key) AS usage, (t.raw->>'note')::text as note, wc.entity_id, e.name as entity_name
      FROM public.wallet_transactions t
      LEFT JOIN public.wallet_connections wc ON t.wallet_address = wc.wallet_address AND t.user_id = wc.user_id
      LEFT JOIN public.entities e ON wc.entity_id = e.id
      LEFT JOIN public.transaction_usage_labels ul ON ul.tx_id = t.id
  ) sub
  ORDER BY tx_hash, user_id, normalized_asset, raw_amount, type_direction, date DESC
),
unified_base AS (
  -- On-chain mapped to all_transactions schema
  SELECT 
    id, user_id, tx_hash AS reference_id, date,
    'On-chain: ' || type_direction || ' ' || raw_asset AS description,
    CASE 
      WHEN (type_direction ILIKE 'withdraw%' OR type_direction IN ('send', 'out')) THEN -raw_amount
      ELSE raw_amount
    END AS amount,
    raw_asset AS raw_asset_name, normalized_asset AS asset,
    NULL::text AS quote_asset, 0.0::double precision as price,
    type_direction AS type, 'on-chain' as source, chain, wallet_address, NULL::text AS connection_name,
    value_usd, usage, note, entity_id, entity_name
  FROM onchain_raw

  UNION ALL

  -- Exchange
  SELECT
    et.id::text, et.user_id, et.trade_id::text AS reference_id, et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.symbol AS description,
    CASE 
      WHEN et.side = 'buy' THEN et.amount
      WHEN et.side = 'sell' THEN -(et.amount / NULLIF(et.price, 0))
      WHEN et.side IN ('deposit', 'earn_redeem') THEN et.amount
      WHEN et.side IN ('withdrawal', 'earn_subscribe') THEN -et.amount
      ELSE et.amount 
    END AS amount,
    CASE WHEN position('/' in et.symbol) > 0 THEN split_part(et.symbol, '/', 1) ELSE et.symbol END AS raw_asset_name,
    public.normalize_crypto_asset(CASE WHEN position('/' in et.symbol) > 0 THEN split_part(et.symbol, '/', 1) ELSE et.symbol END) AS asset,
    CASE WHEN position('/' in et.symbol) > 0 THEN split_part(et.symbol, '/', 2) ELSE NULL::text END AS quote_asset,
    et.price as price, 
    CASE WHEN et.side = 'buy' THEN 'buy' WHEN et.side = 'sell' THEN 'sell' WHEN et.side = 'earn_subscribe' THEN 'withdrawal' WHEN et.side = 'earn_redeem' THEN 'deposit' ELSE et.side END AS type,
    'exchange' as source, et.exchange AS chain, NULL::text AS wallet_address,
    ec.connection_name, 
    COALESCE(et.value_usd, 0) AS value_usd, 
    COALESCE(et.usage, ul.usage_key) AS usage, (et.raw_data->>'note')::text as note,
    ec.entity_id, e.name as entity_name
  FROM public.exchange_trades et
  LEFT JOIN public.exchange_connections ec ON et.exchange_connection_id = ec.id
  LEFT JOIN public.entities e ON ec.entity_id = e.id
  LEFT JOIN public.transaction_usage_labels ul ON ul.ctx_id = et.trade_id::text
)
SELECT 
    b.*,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY' LIMIT 1), 1))::numeric AS value_jpy,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR' LIMIT 1), 1))::numeric AS value_eur,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'GBP' LIMIT 1), 1))::numeric AS value_gbp,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'INR' LIMIT 1), 1))::numeric AS value_inr,
    (ABS(value_usd) * SIGN(amount) * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'SGD' LIMIT 1), 1))::numeric AS value_sgd
FROM unified_base b;

-- 4. Dependent Views
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
SELECT * FROM public.v_holdings;

CREATE OR REPLACE VIEW public.v_balance_sheet WITH (security_invoker = true) AS
SELECT * FROM public.v_holdings;

CREATE OR REPLACE VIEW public.v_cash_flow_statement WITH (security_invoker = true) AS
SELECT * FROM public.v_all_transactions_classified;

-- 5. Permissions
GRANT SELECT ON public.all_transactions TO authenticated, service_role;
GRANT SELECT ON public.v_all_transactions_classified TO authenticated, service_role;
GRANT SELECT ON public.v_holdings TO authenticated, service_role;
GRANT SELECT ON public.v_profit_loss_statement TO authenticated, service_role;
GRANT SELECT ON public.v_balance_sheet TO authenticated, service_role;
GRANT SELECT ON public.v_cash_flow_statement TO authenticated, service_role;
