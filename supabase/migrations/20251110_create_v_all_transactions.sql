-- v_all_transactions FINAL & COMPLETE: Uses 'wallet_connections' to identify internal transfers.
-- This version rebuilds the view to correctly categorize internal vs external transactions.

DROP VIEW IF EXISTS public.v_all_transactions CASCADE;

CREATE OR REPLACE VIEW public.v_all_transactions AS
WITH
-- Step 1: ご指摘の通り 'wallet_connections' テーブルからユーザーの全アドレスリストを作成
user_addresses AS (
  SELECT user_id, wallet_address AS address FROM public.wallet_connections
),

-- Step 2: オンチェーン取引を分類
onchain_txs AS (
  SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'UNKNOWN_ASSET') AS asset,
    t.chain_id::text AS chain,
    -- 取引相手がユーザーの連携済みウォレットの場合 'internal_transfer' に分類
    CASE
      WHEN t.direction = 'in' AND t.from_address IN (SELECT address FROM user_addresses ua WHERE ua.user_id = t.user_id) THEN 'internal_transfer'
      WHEN t.direction = 'out' AND t.to_address IN (SELECT address FROM user_addresses ua WHERE ua.user_id = t.user_id) THEN 'internal_transfer'
      ELSE t.direction -- それ以外は真の「入金(in)」または「送金(out)」
    END AS type
  FROM
    public.wallet_transactions t
),

-- Step 3: 取引所の取引を分類
exchange_txs AS (
  -- Section A: 法定通貨との売買
  SELECT
    et.trade_id::text AS id, et.user_id, et.trade_id::text AS reference_id, et.ts AS date,
    (et.raw_data->>'obtainAmount')::numeric AS amount,
    (et.raw_data->>'cryptoCurrency') AS asset,
    et.exchange AS chain,
    CASE
      WHEN et.raw_data->>'transactionType' = '0' THEN 'buy'
      WHEN et.raw_data->>'transactionType' = '1' THEN 'sell'
      ELSE 'unknown'
    END AS type,
    (et.raw_data->>'sourceAmount')::numeric AS acquisition_price_total,
    (et.raw_data->>'fiatCurrency') AS quote_asset
  FROM public.exchange_trades et
  WHERE et.symbol LIKE '%/%'
  UNION ALL
  -- Section B: 暗号資産の出金
  SELECT
    et.trade_id::text, et.user_id, et.trade_id::text, et.ts,
    et.amount, et.symbol, et.exchange,
    -- 出金先がユーザーの連携済みウォレットの場合 'internal_transfer' に分類
    CASE
      WHEN (et.raw_data->>'address') IN (SELECT address FROM user_addresses ua WHERE ua.user_id = et.user_id) THEN 'internal_transfer'
      ELSE 'OUT' -- それ以外は真の「外部出金(OUT)」
    END AS type,
    NULL::numeric, NULL
  FROM public.exchange_trades et
  WHERE et.side = 'withdrawal'
)

-- Final Step: 全ての分類済み取引を結合して最終ビューを作成
SELECT
    id, user_id, reference_id, date,
    type || ' ' || amount::text || ' ' || asset AS description,
    amount, asset,
    (SELECT quote_asset FROM exchange_txs etx WHERE etx.id = all_txs.id) as quote_asset,
    CASE
        WHEN type = 'buy' OR type = 'sell' THEN (SELECT acquisition_price_total FROM exchange_txs etx WHERE etx.id = all_txs.id) / amount
        ELSE NULL
    END AS price,
    (SELECT acquisition_price_total FROM exchange_txs etx WHERE etx.id = all_txs.id) as acquisition_price_total,
    type,
    CASE WHEN chain ~ '^[0-9\.]+$' THEN 'on-chain' ELSE 'exchange' END AS source,
    chain
FROM (
    SELECT id, user_id, reference_id, date, amount, asset, chain, type, NULL::numeric as acquisition_price_total, NULL as quote_asset FROM onchain_txs
    UNION ALL
    SELECT id, user_id, reference_id, date, amount, asset, chain, type, acquisition_price_total, quote_asset FROM exchange_txs
) AS all_txs;
