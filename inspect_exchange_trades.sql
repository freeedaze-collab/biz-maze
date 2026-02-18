-- ================================================
-- EXCHANGE_TRADES DETAILED INSPECTION
-- ================================================
-- Goal: Check why only 1 fee row is generated when 3 have fee values

-- ================================================
-- Query 1: Show ALL exchange_trades data with fee info
-- ================================================
SELECT 
    trade_id,
    symbol,
    side,
    amount,
    fee,
    fee_currency,
    ts,
    -- Diagnostic columns
    CASE WHEN fee IS NULL THEN '❌ NULL' WHEN fee = 0 THEN '⚠️ ZERO' ELSE '✅ HAS VALUE' END as fee_status,
    CASE WHEN fee_currency IS NULL THEN '❌ NULL' ELSE '✅ HAS VALUE' END as fee_currency_status,
    -- Final check
    CASE 
        WHEN fee IS NULL THEN '❌ fee is NULL'
        WHEN fee = 0 THEN '❌ fee is zero'
        WHEN fee_currency IS NULL THEN '❌ fee_currency is NULL ← LIKELY ISSUE'
        ELSE '✅ SHOULD create fee row'
    END as will_generate_fee_row
FROM exchange_trades
ORDER BY ts DESC;

-- ================================================
-- Query 2: Focus on the 3 trades with fee values
-- ================================================
SELECT 
    trade_id,
    symbol,
    amount,
    fee,
    fee_currency,
    side,
    CASE 
        WHEN fee > 0 AND fee_currency IS NOT NULL THEN '✅ Will create fee row'
        WHEN fee > 0 AND fee_currency IS NULL THEN '❌ Has fee but fee_currency is NULL'
        ELSE '❌ fee is 0 or NULL'
    END as status
FROM exchange_trades
WHERE fee > 0
ORDER BY fee DESC;

-- ================================================
-- Query 3: Check data types
-- ================================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'exchange_trades'
  AND column_name IN ('fee', 'fee_currency')
ORDER BY ordinal_position;

-- ================================================
-- Query 4: Compare with generated fee rows
-- ================================================
-- Show what fee rows were actually generated
SELECT 
    'Generated fee row' as type,
    id,
    parent_id,
    asset as fee_asset,
    amount as fee_amount,
    usage
FROM all_transactions
WHERE row_type = 'fee';

-- ================================================
-- Query 5: Manual simulation of fee_transactions CTE
-- ================================================
-- This simulates what the migration SHOULD generate
SELECT 
    ('e_' || et.trade_id) as main_id,
    ('e_' || et.trade_id || '_fee') as expected_fee_id,
    et.fee,
    et.fee_currency,
    et.side,
    CASE 
        WHEN et.fee IS NOT NULL AND et.fee > 0 AND et.fee_currency IS NOT NULL 
        THEN '✅ Should create fee row'
        ELSE '❌ Will be excluded by WHERE clause'
    END as status
FROM exchange_trades et
ORDER BY et.ts DESC;
