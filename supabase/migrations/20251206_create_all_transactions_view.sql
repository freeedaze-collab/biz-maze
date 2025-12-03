-- supabase/migrations/20251206_create_all_transactions_view.sql

-- 既存のビューがあれば安全に削除
DROP VIEW IF EXISTS public.all_transactions;

-- お客様の実際のスキーマ（異なるID型）の「真実」にのみ準拠した、最終的な統合ビュー
CREATE OR REPLACE VIEW public.all_transactions AS

-- =================================================================
-- オンチェーン取引 (FROM: public.wallet_transactions)
-- =================================================================
SELECT
    t.id::text, -- [最重要修正] UUID型をTEXT型にキャスト
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 10^18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset,
    t.direction AS type,
    'on-chain' as source,
    t.chain_id::text AS chain
FROM
    public.wallet_transactions t

UNION ALL

-- =================================================================
-- オフチェーン取引 (FROM: public.exchange_trades)
-- =================================================================
SELECT
    et.id::text, -- [最重要修正] BIGINT型をTEXT型にキャスト
    et.user_id,
    et.raw_data->>'id' AS reference_id,
    to_timestamp((et.raw_data->>'timestamp')::numeric / 1000) AS date,
    'Exchange: ' || (et.raw_data->>'side') || ' ' || (et.raw_data->>'symbol') AS description,
    (et.raw_data->>'amount')::numeric AS amount,
    split_part(et.raw_data->>'symbol', '/', 1) AS asset,
    et.raw_data->>'side' AS type,
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et;
