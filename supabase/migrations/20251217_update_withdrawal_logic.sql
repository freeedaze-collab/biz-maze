-- supabase/migrations/20251217_update_withdrawal_logic.sql

-- 既存のビューを削除し、依存関係を再構築します。
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions CASCADE;

CREATE OR REPLACE VIEW public.v_all_transactions AS
WITH
-- Step 1: ユーザーが連携している全てのウォレットアドレスと取引所の接続情報を統合
-- connection_identifier を TEXT 型に統一
user_connections AS (
  SELECT
    user_id,
    wallet_address AS connection_identifier,
    'wallet' AS connection_type
  FROM public.wallet_connections
  UNION ALL
  SELECT
    user_id,
    id::text AS connection_identifier, -- BIGINTをTEXTにキャスト
    'exchange' AS connection_type
  FROM public.exchange_connections
),

-- Step 2: オンチェーントランザクションを分類し、USD換算値と価格を追加
onchain_txs AS (
  SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'UNKNOWN_ASSET') AS asset,
    t.chain_id::text AS chain,
    -- 送金元/送金先がユーザーの連携済みウォレットの場合 'internal_transfer' に分類
    CASE
      WHEN t.direction = 'in' AND t.from_address IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = t.user_id AND uc.connection_type = 'wallet') THEN 'internal_transfer'
      WHEN t.direction = 'out' AND t.to_address IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = t.user_id AND uc.connection_type = 'wallet') THEN 'internal_transfer'
      ELSE t.direction -- それ以外は真の「入金(in)」または「送金(out)」
    END AS type,
    NULL::numeric AS acquisition_price_total, -- exchange_txs と整合性をとるために追加
    NULL::text AS quote_asset,               -- exchange_txs と整合性をとるために追加
    t.value_usd AS value_in_usd, -- USD換算値を追加
    CASE
      WHEN (t.value_wei / 1e18) > 0 AND t.value_usd IS NOT NULL THEN (t.value_usd / (t.value_wei / 1e18))
      ELSE NULL
    END AS price -- 価格を追加 (USD換算値 / 数量)
  FROM
    public.wallet_transactions t
),

-- Step 3: 取引所の取引を分類し、USD換算値と価格を追加
exchange_txs AS (
  -- Section A: 法定通貨との売買 (buy/sell)
  SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    (et.raw_data->>'obtainAmount')::numeric AS amount,
    (et.raw_data->>'cryptoCurrency') AS asset,
    et.exchange AS chain,
    CASE
      WHEN et.raw_data->>'transactionType' = '0' THEN 'buy'
      WHEN et.raw_data->>'transactionType' = '1' THEN 'sell'
      ELSE 'unknown'
    END AS type,
    (et.raw_data->>'sourceAmount')::numeric AS acquisition_price_total,
    (et.raw_data->>'fiatCurrency') AS quote_asset,
    et.value_usd AS value_in_usd, -- USD換算値を追加
    CASE
      WHEN (et.raw_data->>'obtainAmount')::numeric > 0 AND et.value_usd IS NOT NULL THEN et.value_usd / (et.raw_data->>'obtainAmount')::numeric
      ELSE NULL
    END AS price -- 価格を追加
  FROM public.exchange_trades et
  WHERE et.symbol LIKE '%/%'

  UNION ALL

  -- Section B: 暗号資産の出金 (withdrawal)
  SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    et.amount,
    et.symbol AS asset,
    et.exchange AS chain,
    -- 出金先がユーザーの連携済みウォレット/取引所の場合 'internal_transfer' に分類
    CASE
      WHEN (et.raw_data->>'address') IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = et.user_id AND uc.connection_type = 'wallet') THEN 'internal_transfer'
      -- et.exchange_connection_id を TEXT にキャストして比較
      WHEN et.exchange_connection_id::text IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = et.user_id AND uc.connection_type = 'exchange') THEN 'internal_transfer'
      ELSE 'withdrawal' -- それ以外は真の「外部出金(withdrawal)」
    END AS type,
    NULL::numeric AS acquisition_price_total, -- withdrawalでは不要、NULLを明示
    NULL::text AS quote_asset,               -- withdrawalでは不要、NULLを明示
    et.value_usd AS value_in_usd, -- USD換算値を追加
    CASE
      WHEN et.amount > 0 AND et.value_usd IS NOT NULL THEN et.value_usd / et.amount
      ELSE NULL
    END AS price -- 価格を追加
  FROM public.exchange_trades et
  WHERE et.side = 'withdrawal'

  UNION ALL

  -- Section C: 暗号資産の入金 (deposit)
  SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    et.amount,
    et.symbol AS asset,
    et.exchange AS chain,
    -- 入金元がユーザーの連携済みウォレット/取引所の場合 'internal_transfer' に分類
    CASE
      WHEN (et.raw_data->>'address') IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = et.user_id AND uc.connection_type = 'wallet') THEN 'internal_transfer'
      -- et.exchange_connection_id を TEXT にキャストして比較
      WHEN et.exchange_connection_id::text IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = et.user_id AND uc.connection_type = 'exchange') THEN 'internal_transfer'
      ELSE 'deposit' -- それ以外は真の「外部入金(deposit)」
    END AS type,
    NULL::numeric AS acquisition_price_total, -- depositでは不要、NULLを明示
    NULL::text AS quote_asset,               -- depositでは不要、NULLを明示
    et.value_usd AS value_in_usd, -- USD換算値を追加
    CASE
      WHEN et.amount > 0 AND et.value_usd IS NOT NULL THEN et.value_usd / et.amount
      ELSE NULL
    END AS price
  FROM public.exchange_trades et
  WHERE et.side = 'deposit'
),

-- Step 4: 全ての分類済み取引を結合
all_combined_txs AS (
    SELECT
        id, user_id, reference_id, date, amount, asset, chain, type, acquisition_price_total, quote_asset, value_in_usd, price
    FROM onchain_txs
    UNION ALL
    SELECT
        id, user_id, reference_id, date, amount, asset, chain, type, acquisition_price_total, quote_asset, value_in_usd, price
    FROM exchange_txs
)

-- Final Step: 最終ビューを作成
SELECT
    id,
    user_id,
    reference_id,
    date,
    type || ' ' || amount::text || ' ' || asset AS description,
    amount,
    asset,
    quote_asset,
    price,
    acquisition_price_total,
    value_in_usd,
    type,
    CASE WHEN chain ~ '^[0-9\.]+$' THEN 'on-chain' ELSE 'exchange' END AS source,
    chain,
    -- 内部送金の場合、usageを'internal_transfer'に設定。それ以外は既存のロジック（またはNULL）
    CASE
      WHEN type = 'internal_transfer' THEN 'internal_transfer'
      ELSE NULL -- 必要に応じてexchange_tradesやwallet_transactionsからusageをマッピング
    END AS usage,
    NULL::text AS note -- 必要に応じてnoteを追加
FROM all_combined_txs;


-- v_holdingsの再構築
-- v_all_transactionsに依存するため、v_all_transactionsの定義後に実行

CREATE OR REPLACE VIEW public.v_holdings AS
WITH latest_prices AS (
    -- 各資産の最新の価格を取得
    SELECT DISTINCT ON (asset)
        asset,
        price AS latest_usd_price
    FROM public.v_all_transactions
    WHERE value_in_usd IS NOT NULL AND amount > 0 AND price IS NOT NULL
    ORDER BY asset, date DESC
),
transaction_summary AS (
    SELECT
        user_id,
        asset,
        SUM(
            CASE
                WHEN type IN ('deposit', 'buy') THEN amount
                WHEN type IN ('withdrawal', 'sell') THEN -amount
                ELSE 0
            END
        ) AS total_amount,
        SUM(
            CASE
                WHEN type IN ('deposit', 'buy') THEN value_in_usd
                WHEN type IN ('withdrawal', 'sell') THEN -value_in_usd
                ELSE 0
            END
        ) AS total_value_usd
    FROM
        public.v_all_transactions
    WHERE
        type NOT IN ('internal_transfer') -- 内部送金は保有残高に影響しないため除外
    GROUP BY
        user_id,
        asset
)
SELECT
    ts.user_id,
    ts.asset,
    ts.total_amount AS quantity,
    COALESCE(ts.total_value_usd, ts.total_amount * lp.latest_usd_price) AS current_value_usd,
    lp.latest_usd_price AS price_per_unit_usd,
    CURRENT_TIMESTAMP AS last_updated
FROM
    transaction_summary ts
LEFT JOIN
    latest_prices lp ON ts.asset = lp.asset
WHERE
    ts.total_amount <> 0; -- 残高が0ではないもののみ表示
