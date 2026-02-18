-- ===================================================================
-- Supabase リモート環境の最新バックアップ取得クエリ
-- ===================================================================
-- 本番環境（ymddtgbsybvxfitgupqy）のSQL Editorで実行してください
-- 結果をコピーして、ローカルに保存してください
-- ===================================================================

-- 重要なマスターデータのバックアップ
-- ===================================================================

-- 1. asset_prices（資産価格マスター）
-- ===================================================================
SELECT 
    'INSERT INTO public.asset_prices (asset, current_price, last_updated) VALUES' ||
    string_agg(
        format('(%L, %s, %L)', 
            asset, 
            current_price, 
            last_updated
        ),
        ', ' || E'\n'
    ) || 
    E'\nON CONFLICT (asset) DO UPDATE SET current_price = EXCLUDED.current_price, last_updated = EXCLUDED.last_updated;'
FROM public.asset_prices;

-- 2. daily_exchange_rates（為替レートマスター）
-- ===================================================================
-- 最新30日分のみ
SELECT 
    'INSERT INTO public.daily_exchange_rates (date, source_currency, target_currency, rate, created_at) VALUES ' ||
    string_agg(
        format('(%L, %L, %L, %s, %L)', 
            date, 
            source_currency, 
            target_currency,
            rate,
            created_at
        ),
        ', ' || E'\n'
        ORDER BY date DESC
    ) || 
    ';'
FROM (
    SELECT * FROM public.daily_exchange_rates
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
) AS subquery;

-- 3. entities（エンティティマスター）
-- ===================================================================
SELECT 
    'INSERT INTO public.entities (id, user_id, name, type, country, currency, parent_id, is_default, created_at, updated_at) VALUES' ||
    string_agg(
        format('(%L, %L, %L, %L, %L, %L, %L, %s, %L, %L)', 
            id::text,
            user_id::text,
            name,
            type,
            country,
            currency,
            parent_id::text,
            COALESCE(is_default::text, 'false'),
            created_at,
            updated_at
        ),
        ', ' || E'\n'
    ) || 
    E'\nON CONFLICT (id) DO NOTHING;'
FROM public.entities;

-- 4. profiles（ユーザープロフィール）
-- ===================================================================
SELECT 
    'INSERT INTO public.profiles (id, email, display_name, company_name, created_at, updated_at) VALUES' ||
    string_agg(
        format('(%L, %L, %L, %L, %L, %L)', 
            id::text,
            email,
            display_name,
            company_name,
            created_at,
            updated_at
        ),
        ', ' || E'\n'
    ) || 
    E'\nON CONFLICT (id) DO NOTHING;'
FROM public.profiles;

-- 5. wallet_connections（ウォレット接続情報）- 機密情報は除外
-- ===================================================================
SELECT 
    'INSERT INTO public.wallet_connections (id, user_id, wallet_address, chain, wallet_name, entity_id, created_at) VALUES' ||
    string_agg(
        format('(%L, %L, %L, %L, %L, %L, %L)', 
            id::text,
            user_id::text,
            wallet_address,
            chain,
            wallet_name,
            entity_id::text,
            created_at
        ),
        ', ' || E'\n'
    ) || 
    E'\nON CONFLICT (id) DO NOTHING;'
FROM public.wallet_connections;

-- 6. exchange_connections（取引所接続情報）- 機密情報は除外
-- ===================================================================
SELECT 
    'INSERT INTO public.exchange_connections (id, user_id, exchange, connection_name, entity_id, created_at) VALUES' ||
    string_agg(
        format('(%L, %L, %L, %L, %L, %L)', 
            id::text,
            user_id::text,
            exchange,
            connection_name,
            entity_id::text,
            created_at
        ),
        ', ' || E'\n'
    ) || 
    E'\nON CONFLICT (id) DO NOTHING;'
FROM public.exchange_connections;

-- 7. 統計情報（参考）
-- ===================================================================
SELECT 
    'asset_prices' AS table_name,
    COUNT(*) AS count,
    MAX(last_updated) AS last_updated
FROM public.asset_prices
UNION ALL
SELECT 
    'daily_exchange_rates',
    COUNT(*),
    MAX(created_at)
FROM public.daily_exchange_rates
UNION ALL
SELECT 
    'wallet_transactions',
    COUNT(*),
    MAX(timestamp)
FROM public.wallet_transactions
UNION ALL
SELECT 
    'exchange_trades',
    COUNT(*),
    MAX(ts)
FROM public.exchange_trades;
