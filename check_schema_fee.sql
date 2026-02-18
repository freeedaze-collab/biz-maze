-- Check wallet_transactions schema
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'wallet_transactions'
ORDER BY ordinal_position;

-- Check if fee columns exist
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'wallet_transactions'
AND column_name LIKE '%fee%'
ORDER BY column_name;

-- Check exchange_trades schema
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'exchange_trades'
ORDER BY ordinal_position;

-- Check if fee columns exist in exchange_trades
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'exchange_trades'
AND column_name LIKE '%fee%'
ORDER BY column_name;

-- Check current all_transactions view definition
SELECT pg_get_viewdef('all_transactions', true);
