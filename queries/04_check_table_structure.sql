-- ===================================================================
-- 4. テーブル構造の詳細確認
-- ===================================================================
-- 主要テーブルのカラム一覧、データ型、NULL可否、デフォルト値を確認
-- ローカル開発環境との差分を把握できます
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
