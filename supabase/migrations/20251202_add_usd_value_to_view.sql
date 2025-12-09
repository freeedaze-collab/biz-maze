-- supabase/migrations/20251202_add_usd_value_to_view.sql
DROP VIEW IF EXISTS public.v_all_transactions;

CREATE OR REPLACE VIEW public.v_all_transactions AS
-- Wallet Transactions (final schema)
SELECT
  w.user_id,
  'wallet'::text AS source,
  w.id::text AS source_id,
  w.tx_hash,
  w.timestamp AS ts,
  w.chain_id::text AS chain,
  (CASE w.direction WHEN 'out' THEN -1 ELSE 1 END) * w.value_wei AS amount,
  w.asset_symbol AS asset,
  NULL::text AS exchange,
  NULL::text AS symbol,
  w.usd_value_at_tx AS value_usd
FROM
  public.wallet_transactions w

UNION ALL

-- Exchange Trades (robust JSON extraction)
SELECT
  e.user_id,
  'exchange'::text AS source,
  (e.raw_data->>'id') AS source_id,
  (e.raw_data->>'id') AS tx_hash,
  to_timestamp((e.raw_data->>'timestamp')::bigint / 1000.0) AS ts,
  NULL::text AS chain,
  (CASE LOWER(e.raw_data->>'side') WHEN 'sell' THEN -1 ELSE 1 END) * (e.raw_data->>'amount')::numeric AS amount,
  split_part((e.raw_data->>'symbol'), '/', 1) AS asset,
  e.exchange,
  (e.raw_data->>'symbol') as symbol,
  (e.raw_data->>'cost')::numeric AS value_usd
FROM
  public.exchange_trades e;
