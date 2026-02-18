-- ===================================================================
-- 開発環境 状態確認クエリ
-- ===================================================================
-- 開発環境（yelkjimxejmrkfzeumos）のSQL Editorで実行してください
-- https://supabase.com/dashboard/project/yelkjimxejmrkfzeumos/sql/new
-- ===================================================================

-- 1. マイグレーション数
SELECT COUNT(*) AS total_migrations FROM supabase_migrations.schema_migrations;

-- 2. テーブルデータ数
SELECT 'users' AS table_name, COUNT(*) AS count FROM auth.users
UNION ALL
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'entities', COUNT(*) FROM public.entities
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
ORDER BY table_name;

-- 3. ビュー動作確認
SELECT 'all_transactions' AS view_name, COUNT(*) AS count FROM public.all_transactions
UNION ALL
SELECT 'v_holdings', COUNT(*) FROM public.v_holdings
UNION ALL
SELECT 'v_balance_sheet', COUNT(*) FROM public.v_balance_sheet
ORDER BY view_name;
