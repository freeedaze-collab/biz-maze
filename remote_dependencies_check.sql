-- ===================================================================
-- Supabase スキーマ依存関係・計算式の詳細確認クエリ
-- ===================================================================
-- 本番環境（ymddtgbsybvxfitgupqy）のSQL Editorで実行してください
-- ===================================================================

-- 1. ビューの定義と依存関係を完全に取得
-- ===================================================================
SELECT 
    v.table_name AS view_name,
    pg_get_viewdef(v.table_schema || '.' || v.table_name, true) AS view_definition_formatted
FROM information_schema.views v
WHERE v.table_schema = 'public'
ORDER BY v.table_name;

-- 2. ビュー間の依存関係を取得
-- ===================================================================
SELECT DISTINCT
    dependent_view.relname AS dependent_view,
    source_table.relname AS source_table_or_view,
    CASE 
        WHEN source_table.relkind = 'v' THEN 'view'
        WHEN source_table.relkind = 'r' THEN 'table'
        ELSE source_table.relkind::text
    END AS source_type
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_class AS source_table ON pg_depend.refobjid = source_table.oid
JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
WHERE dependent_ns.nspname = 'public'
  AND source_ns.nspname = 'public'
  AND dependent_view.relname != source_table.relname
  AND dependent_view.relkind = 'v'
ORDER BY dependent_view.relname, source_table.relname;

-- 3. テーブルのデフォルト値と計算式（GENERATED列）
-- ===================================================================
SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.column_default,
    c.is_nullable,
    c.is_generated,
    c.generation_expression,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name NOT LIKE 'pg_%'
  AND (
    c.column_default IS NOT NULL 
    OR c.is_generated = 'ALWAYS'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 4. 全制約の詳細（PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK）
-- ===================================================================
SELECT
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    tc.is_deferrable,
    tc.initially_deferred,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
LEFT JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 5. 外部キー関係の可視化（参照関係マップ）
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

-- 6. 関数の詳細定義（ストアドプロシージャ、トリガー関数）
-- ===================================================================
SELECT 
    p.proname AS function_name,
    pg_catalog.pg_get_function_arguments(p.oid) AS arguments,
    pg_catalog.pg_get_function_result(p.oid) AS return_type,
    CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
    END AS volatility,
    p.prosecdef AS security_definer,
    pg_catalog.pg_get_functiondef(p.oid) AS function_definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 7. トリガーの詳細（トリガー関数の紐付き）
-- ===================================================================
SELECT 
    t.trigger_name,
    t.event_object_table AS table_name,
    t.action_timing,
    string_agg(DISTINCT t.event_manipulation, ', ') AS events,
    t.action_orientation,
    t.action_statement,
    pg_get_triggerdef(pg_trigger.oid, true) AS trigger_definition
FROM information_schema.triggers t
JOIN pg_trigger ON pg_trigger.tgname = t.trigger_name
WHERE t.trigger_schema = 'public'
GROUP BY 
    t.trigger_name,
    t.event_object_table,
    t.action_timing,
    t.action_orientation,
    t.action_statement,
    pg_trigger.oid
ORDER BY t.event_object_table, t.trigger_name;

-- 8. シーケンス（自動採番）の現在値
-- ===================================================================
SELECT 
    s.sequence_name,
    s.data_type,
    s.start_value,
    s.minimum_value,
    s.maximum_value,
    s.increment,
    s.cycle_option,
    pg_sequence_last_value(s.sequence_schema || '.' || s.sequence_name) AS last_value
FROM information_schema.sequences s
WHERE s.sequence_schema = 'public'
ORDER BY s.sequence_name;

-- 9. インデックスの詳細（カラム構成と種類）
-- ===================================================================
SELECT
    i.schemaname,
    i.tablename,
    i.indexname,
    a.attname AS column_name,
    am.amname AS index_type,
    i.indexdef AS index_definition,
    pg_size_pretty(pg_relation_size(c.oid)) AS index_size
FROM pg_indexes i
JOIN pg_class c ON c.relname = i.indexname
JOIN pg_index ix ON ix.indexrelid = c.oid
JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
JOIN pg_am am ON am.oid = c.relam
WHERE i.schemaname = 'public'
ORDER BY i.tablename, i.indexname, a.attnum;

-- 10. ビューの計算カラムの詳細（ビュー定義から自動抽出される）
-- ===================================================================
SELECT 
    table_name AS view_name,
    column_name,
    data_type,
    is_nullable,
    character_maximum_length,
    numeric_precision
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    SELECT table_name 
    FROM information_schema.views 
    WHERE table_schema = 'public'
  )
ORDER BY table_name, ordinal_position;

-- 11. RLSポリシーの詳細な定義
-- ===================================================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression,
    pg_get_expr(polqual, polrelid) AS qual_readable,
    pg_get_expr(polwithcheck, polrelid) AS with_check_readable
FROM pg_policies
LEFT JOIN pg_policy ON pg_policy.polname = pg_policies.policyname
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 12. エクステンション一覧
-- ===================================================================
SELECT 
    e.extname AS extension_name,
    e.extversion AS version,
    n.nspname AS schema,
    c.description
FROM pg_extension e
LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
LEFT JOIN pg_description c ON c.objoid = e.oid
ORDER BY e.extname;
