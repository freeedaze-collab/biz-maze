-- ===================================================================
-- 2. 主要テーブルのデータ数確認
-- ===================================================================
-- 各テーブルに実際にどれだけのデータが入っているか確認
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
