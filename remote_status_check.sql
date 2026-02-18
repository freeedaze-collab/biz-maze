-- ===================================================================
-- Supabase リモート環境の状態確認クエリ
-- ===================================================================
-- 本番環境（ymddtgbsybvxfitgupqy）のSQL Editorで実行してください
-- https://supabase.com/dashboard/project/ymddtgbsybvxfitgupqy/sql/new
-- ===================================================================

-- 1. 全テーブルのデータ数を確認
-- ===================================================================
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count
FROM (
    SELECT 
        schemaname,
        tablename,
        query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I.%I', schemaname, tablename), false, true, '') AS xml_count
    FROM pg_tables
    WHERE schemaname = 'public'
) t
ORDER BY tablename;

-- 2. 全ビューの確認
-- ===================================================================
SELECT 
    table_name AS view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. 主要テーブルの詳細データ数（個別確認）
-- ===================================================================
SELECT 'users' AS table_name, COUNT(*) AS count FROM auth.users
UNION ALL
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'entities', COUNT(*) FROM public.entities
UNION ALL
SELECT 'companies', COUNT(*) FROM public.companies
UNION ALL
SELECT 'clients', COUNT(*) FROM public.clients
UNION ALL
SELECT 'wallet_connections', COUNT(*) FROM public.wallet_connections
UNION ALL
SELECT 'wallet_transactions', COUNT(*) FROM public.wallet_transactions
UNION ALL
SELECT 'exchange_connections', COUNT(*) FROM public.exchange_connections
UNION ALL
SELECT 'exchange_trades', COUNT(*) FROM public.exchange_trades
UNION ALL
SELECT 'asset_prices', COUNT(*) FROM public.asset_prices
UNION ALL
SELECT 'daily_exchange_rates', COUNT(*) FROM public.daily_exchange_rates
UNION ALL
SELECT 'wallet_nonces', COUNT(*) FROM public.wallet_nonces
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM public.audit_logs
UNION ALL
SELECT 'internal_transfer_links', COUNT(*) FROM public.internal_transfer_links
ORDER BY table_name;

-- 4. ビューの動作確認
-- ===================================================================
SELECT 'all_transactions' AS view_name, COUNT(*) AS count FROM public.all_transactions
UNION ALL
SELECT 'internal_transfer_pairs', COUNT(*) FROM public.internal_transfer_pairs
UNION ALL
SELECT 'v_all_transactions_classified', COUNT(*) FROM public.v_all_transactions_classified
UNION ALL
SELECT 'v_holdings', COUNT(*) FROM public.v_holdings
UNION ALL
SELECT 'v_profit_loss_statement', COUNT(*) FROM public.v_profit_loss_statement
UNION ALL
SELECT 'v_balance_sheet', COUNT(*) FROM public.v_balance_sheet
UNION ALL
SELECT 'v_cash_flow_statement', COUNT(*) FROM public.v_cash_flow_statement
ORDER BY view_name;

-- 5. 関数の一覧
-- ===================================================================
SELECT 
    routine_name,
    routine_type,
    data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 6. トリガーの一覧
-- ===================================================================
SELECT 
    trigger_name,
    event_object_table AS table_name,
    event_manipulation AS event,
    action_timing AS timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 7. マイグレーション履歴（supabase_migrations テーブル）
-- ===================================================================
SELECT 
    version,
    name
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;

-- 全マイグレーション数
SELECT COUNT(*) AS total_migrations FROM supabase_migrations.schema_migrations;

-- 8. テーブル構造の詳細（主要テーブルのカラム一覧）
-- ===================================================================
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'entities',
    'wallet_connections',
    'wallet_transactions',
    'exchange_connections',
    'exchange_trades'
  )
ORDER BY table_name, ordinal_position;

-- 9. インデックスの確認
-- ===================================================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 10. RLS（Row Level Security）ポリシーの確認
-- ===================================================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 11. 最新データの確認（最終更新日時）
-- ===================================================================
SELECT 
    'wallet_transactions' AS table_name,
    MAX(timestamp) AS latest_record,
    MIN(timestamp) AS earliest_record,
    COUNT(*) AS total_count
FROM public.wallet_transactions
WHERE timestamp IS NOT NULL
UNION ALL
SELECT 
    'exchange_trades',
    MAX(ts),
    MIN(ts),
    COUNT(*)
FROM public.exchange_trades
WHERE ts IS NOT NULL;

-- 12. データベースサイズ
-- ===================================================================
SELECT 
    pg_size_pretty(pg_database_size(current_database())) AS database_size;
