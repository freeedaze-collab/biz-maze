-- 統合ビュー: ウォレット + 取引所の取引を安全に統合
-- to_jsonb 抽出でスキーマ揺れに強く、UNIX ms / ISO の時刻や売買符号をビュー側で調整

-- 既存ビューを再生成（テーブルの有無に応じて内容を切り替える）
DO $$
DECLARE
  has_exchange boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exchange_trades'
  ) INTO has_exchange;

  IF has_exchange THEN
    EXECUTE $$
      CREATE OR REPLACE VIEW public.v_all_transactions AS
      (
        -- Wallet side
        SELECT
          w.user_id,
          'wallet'::text AS source,
          (to_jsonb(w)->>'id') AS source_id,
          w.id AS tx_id,
          concat('wallet:', coalesce(to_jsonb(w)->>'id', w.id::text, 'unknown')) AS ctx_id,
          COALESCE(
            (to_jsonb(w)->>'timestamp')::timestamptz,
            (to_jsonb(w)->>'ts')::timestamptz,
            to_timestamp(NULLIF(to_jsonb(w)->>'time', '')::bigint / 1000.0),
            w.created_at
          ) AS ts,
          COALESCE(to_jsonb(w)->>'chain', to_jsonb(w)->>'chain_id') AS chain,
          COALESCE(to_jsonb(w)->>'tx_hash', to_jsonb(w)->>'transaction_hash') AS tx_hash,
          COALESCE(to_jsonb(w)->>'asset', to_jsonb(w)->>'asset_symbol', to_jsonb(w)->>'currency') AS asset,
          CASE
            WHEN to_jsonb(w)->>'amount' IS NOT NULL THEN (to_jsonb(w)->>'amount')::numeric
            WHEN to_jsonb(w)->>'value_wei' IS NOT NULL THEN (to_jsonb(w)->>'value_wei')::numeric / 1e18
            ELSE NULL
          END AS amount,
          NULL::text AS exchange,
          NULL::text AS symbol,
          NULL::numeric AS fee,
          NULL::text AS fee_asset
        FROM public.wallet_transactions w

        UNION ALL

        -- Exchange side (best-effort: JSON 抽出で必須列の欠落に耐性)
        SELECT
          e.user_id,
          'exchange'::text AS source,
          COALESCE(to_jsonb(e)->>'id', to_jsonb(e)->>'trade_id', to_jsonb(e)->>'txid', to_jsonb(e)->>'order_id') AS source_id,
          nullif((to_jsonb(e)->>'id')::bigint, 0) AS tx_id,
          concat('exchange:', coalesce(to_jsonb(e)->>'id', to_jsonb(e)->>'trade_id', to_jsonb(e)->>'txid', to_jsonb(e)->>'order_id', 'unknown')) AS ctx_id,
          COALESCE(
            (to_jsonb(e)->>'ts')::timestamptz,
            (to_jsonb(e)->>'timestamp')::timestamptz,
            to_timestamp(NULLIF(to_jsonb(e)->>'time', '')::bigint / 1000.0),
            (to_jsonb(e)->>'created_at')::timestamptz
          ) AS ts,
          NULL::text AS chain,
          COALESCE(to_jsonb(e)->>'tx_hash', to_jsonb(e)->>'trade_id') AS tx_hash,
          COALESCE(to_jsonb(e)->>'asset', to_jsonb(e)->>'base_asset') AS asset,
          (CASE LOWER(COALESCE(to_jsonb(e)->>'side', '')) WHEN 'sell' THEN -1 ELSE 1 END) * COALESCE(
            (to_jsonb(e)->>'amount')::numeric,
            (to_jsonb(e)->>'qty')::numeric,
            ((to_jsonb(e)->>'quantity')::numeric)
          ) * COALESCE(NULLIF((to_jsonb(e)->>'price')::numeric, 0), 1) AS amount,
          COALESCE(to_jsonb(e)->>'exchange', to_jsonb(e)->>'exchange_name') AS exchange,
          COALESCE(to_jsonb(e)->>'symbol', to_jsonb(e)->>'pair') AS symbol,
          COALESCE((to_jsonb(e)->>'fee')::numeric, 0) AS fee,
          COALESCE(to_jsonb(e)->>'fee_asset', to_jsonb(e)->>'fee_currency') AS fee_asset
        FROM public.exchange_trades e
      );
    $$;
  ELSE
    -- exchange_trades が無い環境ではウォレットのみのビューを作る
    EXECUTE $$
      CREATE OR REPLACE VIEW public.v_all_transactions AS
      SELECT
        w.user_id,
        'wallet'::text AS source,
        (to_jsonb(w)->>'id') AS source_id,
        w.id AS tx_id,
        concat('wallet:', coalesce(to_jsonb(w)->>'id', w.id::text, 'unknown')) AS ctx_id,
        COALESCE(
          (to_jsonb(w)->>'timestamp')::timestamptz,
          (to_jsonb(w)->>'ts')::timestamptz,
          to_timestamp(NULLIF(to_jsonb(w)->>'time', '')::bigint / 1000.0),
          w.created_at
        ) AS ts,
        COALESCE(to_jsonb(w)->>'chain', to_jsonb(w)->>'chain_id') AS chain,
        COALESCE(to_jsonb(w)->>'tx_hash', to_jsonb(w)->>'transaction_hash') AS tx_hash,
        COALESCE(to_jsonb(w)->>'asset', to_jsonb(w)->>'asset_symbol', to_jsonb(w)->>'currency') AS asset,
        CASE
          WHEN to_jsonb(w)->>'amount' IS NOT NULL THEN (to_jsonb(w)->>'amount')::numeric
          WHEN to_jsonb(w)->>'value_wei' IS NOT NULL THEN (to_jsonb(w)->>'value_wei')::numeric / 1e18
          ELSE NULL
        END AS amount,
        NULL::text AS exchange,
        NULL::text AS symbol,
        NULL::numeric AS fee,
        NULL::text AS fee_asset
      FROM public.wallet_transactions w;
    $$;
  END IF;
END $$;
