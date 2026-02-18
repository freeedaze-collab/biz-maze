-- ===================================================================
-- 5. 外部キー関係の確認
-- ===================================================================
-- テーブル間の参照関係を確認
-- データ投入やマイグレーション時のエラー回避に役立ちます
-- ===================================================================

SELECT
    kcu1.table_name AS from_table,
    kcu1.column_name AS from_column,
    kcu2.table_name AS to_table,
    kcu2.column_name AS to_column,
    rc.update_rule,
    rc.delete_rule,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu1
    ON tc.constraint_name = kcu1.constraint_name
    AND tc.table_schema = kcu1.table_schema
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
JOIN information_schema.key_column_usage kcu2
    ON rc.unique_constraint_name = kcu2.constraint_name
    AND rc.unique_constraint_schema = kcu2.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY kcu1.table_name, kcu1.column_name;
