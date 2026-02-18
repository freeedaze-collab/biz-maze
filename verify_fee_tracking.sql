-- Test query to verify fee tracking is working
-- This should show both main transactions and fee transactions

SELECT 
    id,
    row_type,
    type,
    asset,
    amount,
    usage,
    description,
    parent_id,
    parent_type
FROM public.all_transactions
WHERE date >= NOW() - INTERVAL '30 days'
ORDER BY date DESC, id
LIMIT 50;

-- Count fee vs main transactions
SELECT 
    row_type,
    COUNT(*) as transaction_count
FROM public.all_transactions
GROUP BY row_type;

-- Check specific fee transactions
SELECT 
    parent_id,
    parent_type,
    id,
    asset as fee_asset,
    amount as fee_amount,
    value_usd as fee_value_usd,
    usage as fee_usage
FROM public.all_transactions
WHERE row_type = 'fee'
ORDER BY date DESC
LIMIT 20;
