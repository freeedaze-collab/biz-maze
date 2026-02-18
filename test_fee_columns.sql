-- Test SQL to identify error
-- First, let's check if asset_prices table exists and has correct columns
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'asset_prices'
ORDER BY ordinal_position;

-- Test if the subquery works
SELECT 
    'BTC' AS test_asset,
    (SELECT ap.current_price FROM public.asset_prices ap WHERE upper(ap.asset) = upper('BTC')) AS price;

-- Test if wallet_transactions has fee and fee_asset columns
SELECT column_name, data_type
FROM information_schema.columns  
WHERE table_schema = 'public'
  AND table_name = 'wallet_transactions'
  AND (column_name = 'fee' OR column_name = 'fee_asset')
ORDER BY column_name;

-- Test if exchange_trades has fee and fee_currency columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exchange_trades'
  AND (column_name = 'fee' OR column_name = 'fee_currency')
ORDER BY column_name;
