-- Step-by-step Diagnostic: Find the root cause of 50 records

-- 1. Check v_all_transactions_classified total count
SELECT 'v_all_transactions_classified' as table_name, COUNT(*) as total_count
FROM v_all_transactions_classified;

-- 2. Check all_transactions total count (the source)
SELECT 'all_transactions' as table_name, COUNT(*) as total_count
FROM all_transactions;

-- 3. Check source tables
SELECT 'wallet_transactions' as table_name, COUNT(*) as total_count
FROM wallet_transactions
UNION ALL
SELECT 'exchange_trades' as table_name, COUNT(*) as total_count
FROM exchange_trades;

-- 4. Check all_transactions view definition for any LIMIT
SELECT pg_get_viewdef('all_transactions'::regclass, true);

-- 5. If all_transactions has data, check if it's a fee migration issue
SELECT 
    CASE WHEN parent_id IS NOT NULL THEN 'fee_row' ELSE 'main_row' END as row_category,
    COUNT(*) as count
FROM all_transactions
GROUP BY CASE WHEN parent_id IS NOT NULL THEN 'fee_row' ELSE 'main_row' END;
