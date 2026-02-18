-- Migration: Unified Schema & View Restoration
-- This SQL restores all previously dropped views and fixes the missing columns and USD calculation.

-- 1. Helper function for future maintenance
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE sql_query;
  RETURN jsonb_build_object('status', 'success');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$;

-- 2. Drop with CASCADE to ensure clean state (we will restore everything)
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- 3. Unified all_transactions view
CREATE OR REPLACE VIEW public.all_transactions WITH (security_invoker = true) AS
WITH latest_rates AS (
    SELECT DISTINCT ON (target_currency) target_currency, rate
    FROM public.daily_exchange_rates 
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
onchain_base AS (
  SELECT
    t.id::text as id, t.user_id, t.tx_hash AS reference_id, t.timestamp AS date,
    'On-chain: ' || COALESCE(t.type, t.direction) || ' ' || COALESCE(t.asset, t.asset_symbol, 'ETH') AS description,
    COALESCE(t.amount, (t.value_wei / 1e18), 0) AS amount,
    COALESCE(t.asset, t.asset_symbol, 'ETH') AS asset,
    NULL::text AS quote_asset,
    p.rate as price,
    COALESCE(t.type, t.direction) AS type,
    'on-chain' as source, t.chain_id::text AS chain, t.wallet_address,
    NULL::text AS connection_name,
    COALESCE(
      t.price_usd::numeric * COALESCE(t.amount::numeric, (t.value_wei::numeric / 1e18), 0::numeric),
      t.value_in_usd::numeric,
      (COALESCE(t.amount::numeric, (t.value_wei::numeric / 1e18), 0::numeric) * COALESCE(p.rate::numeric, 0::numeric)),
      0::numeric
    ) AS value_usd,
    COALESCE(t.usage, ul.usage_key) AS usage, (t.raw->>'note')::text as note,
    wc.entity_id, e.name as entity_name
  FROM public.wallet_transactions t
  LEFT JOIN public.wallet_connections wc ON t.wallet_address = wc.wallet_address AND t.user_id = wc.user_id
  LEFT JOIN public.entities e ON wc.entity_id = e.id
  LEFT JOIN LATERAL (
    SELECT rate FROM public.daily_exchange_rates 
    WHERE source_currency = UPPER(COALESCE(t.asset, t.asset_symbol, 'ETH')) AND target_currency = 'USD' 
    AND date <= t.timestamp::date AND date >= (t.timestamp::date - INTERVAL '3 days')
    ORDER BY date DESC LIMIT 1
  ) p ON true
  LEFT JOIN public.transaction_usage_labels ul ON ul.tx_id = t.id
),
exchange_base AS (
  SELECT
    et.id::text as id, et.user_id, et.trade_id::text AS reference_id, et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    CASE 
      WHEN et.side = 'buy' THEN et.amount 
      WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price 
      WHEN et.side = 'earn_redeem' THEN et.amount
      WHEN et.side = 'earn_subscribe' THEN -et.amount
      ELSE et.amount 
    END AS amount,
    CASE 
      WHEN position('/' in et.symbol) > 0 THEN split_part(et.symbol, '/', 1) 
      ELSE et.symbol 
    END AS asset,
    CASE 
      WHEN position('/' in et.symbol) > 0 THEN split_part(et.symbol, '/', 2) 
      ELSE NULL::text 
    END AS quote_asset,
    et.price, 
    CASE 
      WHEN et.side = 'buy' THEN 'buy'
      WHEN et.side = 'sell' THEN 'sell'
      WHEN et.side = 'earn_subscribe' THEN 'withdraw'
      WHEN et.side = 'earn_redeem' THEN 'deposit'
      ELSE et.side 
    END AS type, 
    'exchange' as source, et.exchange AS chain, NULL::text AS wallet_address,
    ec.connection_name, COALESCE(et.value_usd, 0) AS value_usd, COALESCE(et.usage, ul.usage_key) AS usage, (et.raw_data->>'note')::text as note,
    ec.entity_id, e.name as entity_name
  FROM public.exchange_trades et
  LEFT JOIN public.exchange_connections ec ON et.exchange_connection_id = ec.id
  LEFT JOIN public.entities e ON ec.entity_id = e.id
  LEFT JOIN public.transaction_usage_labels ul ON ul.ctx_id = et.trade_id::text -- match trade_id
),
unified_base AS ( SELECT * FROM onchain_base UNION ALL SELECT * FROM exchange_base )
SELECT b.*,
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY' LIMIT 1), 1)) AS value_jpy,
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR' LIMIT 1), 1)) AS value_eur,
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'GBP' LIMIT 1), 1)) AS value_gbp,
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'INR' LIMIT 1), 1)) AS value_inr,
    (b.value_usd * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'SGD' LIMIT 1), 1)) AS value_sgd
FROM unified_base b;

-- 4. Restore Internal Transfer Pairs
CREATE OR REPLACE VIEW public.internal_transfer_pairs WITH (security_invoker = true) AS
SELECT tx_out.user_id, tx_out.id AS withdrawal_id, tx_in.id AS deposit_id
FROM public.all_transactions tx_out JOIN public.all_transactions tx_in ON tx_out.user_id = tx_in.user_id AND tx_out.asset = tx_in.asset
AND (tx_out.type ILIKE 'withdraw%' OR tx_out.type = 'send' OR tx_out.type = 'out')
AND (tx_in.type ILIKE 'deposit%' OR tx_in.type = 'receive' OR tx_in.type = 'in')
AND tx_in.amount BETWEEN (tx_out.amount * 0.99) AND (tx_out.amount * 1.01)
AND tx_in.date >= tx_out.date AND tx_in.date <= (tx_out.date + INTERVAL '24 hours')
AND COALESCE(tx_out.connection_name, tx_out.wallet_address) <> COALESCE(tx_in.connection_name, tx_in.wallet_address);

-- 5. Restore Classified Transactions
CREATE OR REPLACE VIEW public.v_all_transactions_classified WITH (security_invoker = true) AS
WITH all_internal_ids AS ( SELECT withdrawal_id AS id FROM public.internal_transfer_pairs UNION SELECT deposit_id AS id FROM public.internal_transfer_pairs )
SELECT t.*, CASE WHEN ai.id IS NOT NULL THEN 'INTERNAL_TRANSFER' WHEN t.usage IS NOT NULL THEN UPPER(t.usage) WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
WHEN UPPER(t.type) IN ('BUY', 'DEPOSIT', 'IN', 'RECEIVE') THEN 'DEPOSIT' WHEN UPPER(t.type) IN ('SELL', 'WITHDRAWAL', 'OUT', 'SEND') THEN 'WITHDRAWAL' ELSE 'OTHER' END as transaction_type
FROM public.all_transactions t LEFT JOIN all_internal_ids ai ON t.id = ai.id;

-- 6. Restore Holdings (Full Set of Columns)
CREATE OR REPLACE VIEW public.v_holdings WITH (security_invoker = true) AS
WITH latest_rates AS ( SELECT DISTINCT ON (target_currency) target_currency, rate FROM public.daily_exchange_rates WHERE source_currency = 'USD' ORDER BY target_currency, date DESC ),
acquisitions AS (
    SELECT user_id, entity_id, asset, sum(value_usd) AS total_cost_basis, sum(amount) AS total_amount_acquired
    FROM public.v_all_transactions_classified
    WHERE (transaction_type = 'BUY' OR usage IN ('mining_rewards', 'staking_rewards', 'airdrop', 'income')) AND transaction_type <> 'INTERNAL_TRANSFER'
    GROUP BY user_id, entity_id, asset
),
current_quantities AS (
    SELECT user_id, entity_id, entity_name, asset, sum(CASE WHEN UPPER(type) IN ('IN', 'DEPOSIT', 'BUY', 'RECEIVE') THEN amount WHEN UPPER(type) IN ('OUT', 'WITHDRAWAL', 'SELL', 'SEND') THEN -amount ELSE 0 END) AS current_amount
    FROM public.v_all_transactions_classified WHERE transaction_type <> 'INTERNAL_TRANSFER' GROUP BY user_id, entity_id, entity_name, asset
)
SELECT cq.user_id, cq.entity_id, cq.entity_name as entity, cq.asset, cq.current_amount, ap.current_price AS current_price, (cq.current_amount * ap.current_price) AS current_value_usd,
(cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY' LIMIT 1), 1)) AS current_value_jpy,
(cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR' LIMIT 1), 1)) AS current_value_eur,
(cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'GBP' LIMIT 1), 1)) AS current_value_gbp,
(cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'INR' LIMIT 1), 1)) AS current_value_inr,
(cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'SGD' LIMIT 1), 1)) AS current_value_sgd,
COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0) AS "avg_buy_price",
(cq.current_amount * ap.current_price) - (cq.current_amount * COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0)) AS "unrealized_pnl", now() AS last_updated
FROM current_quantities cq JOIN public.asset_prices ap ON TRIM(UPPER(cq.asset)) = TRIM(UPPER(ap.asset)) LEFT JOIN acquisitions acq ON cq.user_id = acq.user_id AND cq.entity_id = acq.entity_id AND cq.asset = acq.asset
WHERE cq.current_amount > 1e-9;

-- 7. Restore Financial Statements
CREATE OR REPLACE VIEW public.v_profit_loss_statement WITH (security_invoker = true) AS
WITH rates AS ( SELECT target_currency, rate FROM (SELECT target_currency, rate, ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn FROM public.daily_exchange_rates WHERE source_currency = 'USD') AS r WHERE rn = 1 ),
pnl_base AS (
    SELECT user_id, entity_id, entity_name, date, 'Sales Revenue (IAS 2)'::text AS account, value_usd AS balance FROM public.all_transactions WHERE usage = 'sale_ias2'
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Consideration Revenue (IFRS 15)'::text, value_usd FROM public.all_transactions WHERE usage = 'revenue_ifrs15'
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Staking & Mining Rewards'::text, value_usd FROM public.all_transactions WHERE usage = ANY (ARRAY['mining_rewards'::text, 'staking_rewards'::text])
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cost of Goods Sold (IAS 2)'::text, -value_usd FROM public.all_transactions WHERE usage = 'sale_ias2'
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Unrealized Gains on Intangibles (Revaluation)'::text, value_usd FROM public.all_transactions WHERE usage = 'revaluation_increase_ias38'
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Unrealized Losses on Intangibles (Impairment)'::text, -value_usd FROM public.all_transactions WHERE usage = ANY (ARRAY['impairment_ias38'::text, 'revaluation_decrease_ias38'::text])
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Gas & Network Fees'::text, -value_usd FROM public.all_transactions WHERE usage = 'gas_fees'
)
SELECT user_id, entity_id, entity_name as entity, date, account, SUM(balance) AS balance, 
SUM(balance) AS balance_usd,
SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY' LIMIT 1), 1)) AS balance_jpy, 
SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR' LIMIT 1), 1)) AS balance_eur,
SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP' LIMIT 1), 1)) AS balance_gbp,
SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR' LIMIT 1), 1)) AS balance_inr,
SUM(balance * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD' LIMIT 1), 1)) AS balance_sgd
FROM pnl_base GROUP BY user_id, entity_id, entity_name, date, account;

CREATE OR REPLACE VIEW public.v_balance_sheet WITH (security_invoker = true) AS
WITH rates AS ( SELECT target_currency, rate FROM (SELECT target_currency, rate, ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn FROM public.daily_exchange_rates WHERE source_currency = 'USD') AS r WHERE rn = 1 ),
movements AS (
    SELECT user_id, entity_id, entity_name, date, 'Inventory (Trading Crypto)'::text AS account, sum(value_usd) AS change FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2' GROUP BY user_id, entity_id, entity_name, date
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Inventory (Trading Crypto)'::text, sum(-value_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'lcnrv_ias2'::text]) GROUP BY user_id, entity_id, entity_name, date
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash & Cash Equivalents'::text, sum(value_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias38'::text, 'sale_ias2'::text]) GROUP BY user_id, entity_id, entity_name, date
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash & Cash Equivalents'::text, sum(-value_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['investment_acquisition_ias38'::text, 'trading_acquisition_ias2'::text]) GROUP BY user_id, entity_id, entity_name, date
)
SELECT user_id, entity_id, entity_name as entity, date, account, SUM(change) AS balance, 
SUM(change) AS balance_usd,
SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY' LIMIT 1), 1)) AS balance_jpy, 
SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR' LIMIT 1), 1)) AS balance_eur,
SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP' LIMIT 1), 1)) AS balance_gbp,
SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR' LIMIT 1), 1)) AS balance_inr,
SUM(change * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD' LIMIT 1), 1)) AS balance_sgd
FROM movements GROUP BY user_id, entity_id, entity_name, date, account;

CREATE OR REPLACE VIEW public.v_cash_flow_statement WITH (security_invoker = true) AS
WITH rates AS ( SELECT target_currency, rate FROM (SELECT target_currency, rate, ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn FROM public.daily_exchange_rates WHERE source_currency = 'USD') AS r WHERE rn = 1 ),
cf_base AS (
    SELECT user_id, entity_id, entity_name, date, 'Cash In from Sales'::text AS item, value_usd AS amount FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'sale_ias38'::text])
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash Out for Inventory'::text, -value_usd FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2'
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash Out for Gas Fees'::text, -value_usd FROM public.all_transactions WHERE usage = 'gas_fees'
    UNION ALL SELECT user_id, entity_id, entity_name, date, 'Cash Out for Intangibles'::text, -value_usd FROM public.all_transactions WHERE usage = 'investment_acquisition_ias38'
)
SELECT user_id, entity_id, entity_name as entity, date, item, SUM(amount) AS amount, 
SUM(amount) AS amount_usd,
SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'JPY' LIMIT 1), 1)) AS amount_jpy, 
SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'EUR' LIMIT 1), 1)) AS amount_eur,
SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'GBP' LIMIT 1), 1)) AS amount_gbp,
SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'INR' LIMIT 1), 1)) AS amount_inr,
SUM(amount * COALESCE((SELECT rate FROM rates WHERE target_currency = 'SGD' LIMIT 1), 1)) AS amount_sgd
FROM cf_base GROUP BY user_id, entity_id, entity_name, date, item;

-- 8. Final Permissions
GRANT SELECT ON public.all_transactions TO authenticated, service_role;
GRANT SELECT ON public.v_all_transactions_classified TO authenticated, service_role;
GRANT SELECT ON public.v_holdings TO authenticated, service_role;
GRANT SELECT ON public.v_profit_loss_statement TO authenticated, service_role;
GRANT SELECT ON public.v_balance_sheet TO authenticated, service_role;
GRANT SELECT ON public.v_cash_flow_statement TO authenticated, service_role;
