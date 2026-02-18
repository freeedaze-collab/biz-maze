-- Query to get exact production all_transactions view definition
SELECT pg_get_viewdef('public.all_transactions', true) AS view_definition;

-- Query to find all views that depend on all_transactions
SELECT DISTINCT
    dependent_ns.nspname AS dependent_schema,
    dependent_view.relname AS dependent_view,
    source_table.relname AS source_table
FROM pg_depend 
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_class AS source_table ON pg_depend.refobjid = source_table.oid
JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
WHERE source_table.relname = 'all_transactions'
  AND dependent_ns.nspname = 'public';

-- Query to check current columns in all_transactions
SELECT 
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'all_transactions'
ORDER BY ordinal_position;
