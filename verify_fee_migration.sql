-- VERIFICATION QUERIES FOR FEE TRACKING MIGRATION
-- Run these in Supabase Studio SQL Editor to diagnose the issue

-- ============================================
-- Step 1: Check if new columns were added to all_transactions
-- ============================================
SELECT 
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'all_transactions'
ORDER BY ordinal_position;

-- Expected: Should see parent_id, parent_type, row_type at the end
-- If these columns are missing, the migration didn't apply

-- ============================================
-- Step 2: Check if any transactions have fee data
-- ============================================
-- Check wallet_transactions for fee data
SELECT 
    COUNT(*) as total_transactions,
    COUNT(fee) as transactions_with_fee,
    COUNT(CASE WHEN fee > 0 THEN 1 END) as transactions_with_positive_fee,
    MIN(fee) as min_fee,
    MAX(fee) as max_fee
FROM wallet_transactions;

-- Check exchange_trades for fee data
SELECT 
    COUNT(*) as total_trades,
    COUNT(fee) as trades_with_fee,
    COUNT(CASE WHEN fee > 0 THEN 1 END) as trades_with_positive_fee,
    MIN(fee) as min_fee,
    MAX(fee) as max_fee
FROM exchange_trades;

-- ============================================
-- Step 3: Check row_type distribution in all_transactions
-- ============================================
SELECT 
    row_type,
    COUNT(*) as count
FROM all_transactions
GROUP BY row_type;

-- Expected: 
-- 'main' = all main transactions
-- 'fee' = fee transactions (if any fees exist in source data)
-- If row_type column doesn't exist, query will fail = migration didn't apply

-- ============================================
-- Step 4: Sample fee transactions (if any)
-- ============================================
SELECT 
    id,
    row_type,
    type,
    description,
    asset,
    amount,
    value_usd,
    usage,
    parent_id,
    parent_type
FROM all_transactions
WHERE row_type = 'fee'
LIMIT 20;

-- If this returns 0 rows but source data has fees, 
-- then fee_transactions CTE logic has an issue

-- ============================================
-- Step 5: Check specific transactions with fees
-- ============================================
-- Find wallet transactions with fees
SELECT 
    id,
    asset,
    amount,
    fee,
    fee_currency,
    type,
    timestamp
FROM wallet_transactions
WHERE fee IS NOT NULL AND fee > 0
LIMIT 5;

-- Find exchange trades with fees
SELECT 
    trade_id,
    symbol,
    amount,
    fee,
    fee_currency,
    side,
    ts
FROM exchange_trades
WHERE fee IS NOT NULL AND fee > 0
LIMIT 5;

-- ============================================
-- Step 6: Manual check - should these create fee rows?
-- ============================================
SELECT 
    ('w_' || wt.id) as main_id,
    ('w_' || wt.id || '_fee') as expected_fee_id,
    wt.asset,
    wt.amount,
    wt.fee,
    wt.fee_currency,
    wt.type
FROM wallet_transactions wt
WHERE wt.fee IS NOT NULL 
  AND wt.fee > 0 
  AND wt.fee_currency IS NOT NULL
LIMIT 5;

-- Check if corresponding fee rows exist
SELECT 
    id,
    row_type,
    description,
    asset,
    amount,
    parent_id
FROM all_transactions
WHERE id LIKE '%_fee'
LIMIT 10;
