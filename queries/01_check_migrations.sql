-- ===================================================================
-- 1. マイグレーション履歴確認
-- ===================================================================
-- 本番環境で実際に適用されているマイグレーションを確認
-- これにより、ローカルのマイグレーションファイルとの差分がわかります
-- ===================================================================

SELECT 
    version,
    name
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 30;

-- 全マイグレーション数
SELECT COUNT(*) AS total_migrations 
FROM supabase_migrations.schema_migrations;
