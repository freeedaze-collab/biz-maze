-- ===================================================================
-- 完全バックアップ用: 全関数・トリガー定義の取得
-- ===================================================================

-- 1. 全関数の定義を取得
SELECT 
    p.proname AS function_name,
    pg_catalog.pg_get_functiondef(p.oid) AS function_definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 2. 全トリガーの定義を取得
-- SELECT 
--     t.trigger_name,
--     t.event_object_table AS table_name,
--     pg_get_triggerdef(pg_trigger.oid, true) AS trigger_definition
-- FROM information_schema.triggers t
-- JOIN pg_trigger ON pg_trigger.tgname = t.trigger_name
-- WHERE t.trigger_schema = 'public'
-- ORDER BY t.event_object_table, t.trigger_name;
