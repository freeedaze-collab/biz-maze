-- ================================================
-- FEE ROW DIAGNOSTIC QUERIES (CORRECTED)
-- ================================================
-- bt.fee does not exist in all_transactions view
-- We need to check source tables directly

-- ================================================
-- Query 1: Check wallet_transactions source data
-- ================================================
SELECT 
    id,
    asset,
    amount,
    fee,
    fee_currency,
    type,
    timestamp,
    CASE 
        WHEN fee IS NULL THEN '❌ fee is NULL'
        WHEN fee = 0 THEN '❌ fee is zero'
        WHEN fee_currency IS NULL THEN '❌ fee_currency is NULL'
        ELSE '✅ SHOULD create fee row'
    END as status
FROM wallet_transactions
ORDER BY timestamp DESC;

-- ================================================
-- Query 2: Check exchange_trades source data
-- ================================================
SELECT 
    trade_id,
    symbol,
    amount,
    fee,
    fee_currency,
    side,
    ts,
    CASE 
        WHEN fee IS NULL THEN '❌ fee is NULL'
        WHEN fee = 0 THEN '❌ fee is zero'
        WHEN fee_currency IS NULL THEN '❌ fee_currency is NULL'
        ELSE '✅ SHOULD create fee row'
    END as status
FROM exchange_trades
ORDER BY ts DESC;

-- ================================================
-- Query 3: Count summary
-- ================================================
SELECT 
    'wallet_transactions' as source,
    COUNT(*) as total,
    COUNT(CASE WHEN fee > 0 AND fee_currency IS NOT NULL THEN 1 END) as should_generate_fee_rows
FROM wallet_transactions
UNION ALL
SELECT 
    'exchange_trades' as source,
    COUNT(*) as total,
    COUNT(CASE WHEN fee > 0 AND fee_currency IS NOT NULL THEN 1 END) as should_generate_fee_rows
FROM exchange_trades;

-- ================================================
-- Query 4: Check actual generated fee rows
-- ================================================
SELECT 
    id,
    description,
    asset as fee_asset,
    amount as fee_amount,
    value_usd,
    usage,
    parent_id,
    parent_type
FROM all_transactions
WHERE row_type = 'fee';

-- ================================================
-- Query 5: Check all_transactions columns
-- ================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'all_transactions'
ORDER BY ordinal_position;
