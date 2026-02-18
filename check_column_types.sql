-- Query to check exact column types in all_transactions view
SELECT 
    column_name,
    data_type,
    udt_name,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'all_transactions'
ORDER BY ordinal_position;

-- Query to check wallet_transactions columns and types
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'wallet_transactions'
  AND column_name IN ('id', 'user_id', 'fee', 'fee_currency')
ORDER BY ordinal_position;

-- Query to check exchange_trades columns and types
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exchange_trades'
  AND column_name IN ('trade_id', 'user_id', 'fee', 'fee_currency')
ORDER BY ordinal_position;

-- Query to check wallet_connections columns
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'wallet_connections'
  AND column_name IN ('id', 'entity_id')
ORDER BY ordinal_position;

-- Query to check exchange_connections columns
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exchange_connections'
  AND column_name IN ('id', 'entity_id')
ORDER BY ordinal_position;
