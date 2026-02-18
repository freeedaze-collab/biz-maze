-- 徹底的な検証クエリ: 開発環境が本番環境と完全に一致しているか確認

-- 1. データが存在するか確認
SELECT 'users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'entities', COUNT(*) FROM public.entities
UNION ALL
SELECT 'wallet_connections', COUNT(*) FROM public.wallet_connections
UNION ALL
SELECT 'wallet_transactions', COUNT(*) FROM public.wallet_transactions
UNION ALL  
SELECT 'exchange_connections', COUNT(*) FROM public.exchange_connections
UNION ALL
SELECT 'exchange_trades', COUNT(*) FROM public.exchange_trades
UNION ALL
SELECT 'asset_prices', COUNT(*) FROM public.asset_prices
UNION ALL
SELECT 'daily_exchange_rates', COUNT(*) FROM public.daily_exchange_rates;

-- 2. all_transactionsビューが正しく動作するか確認
SELECT COUNT(*) as all_transactions_count FROM public.all_transactions;

-- 3. v_holdingsビューが正しく動作するか確認  
SELECT COUNT(*) as v_holdings_count FROM public.v_holdings;

-- 4. 財務計算ビューが正しく動作するか確認
SELECT COUNT(*) as profit_loss_count FROM public.v_profit_loss_statement;
SELECT COUNT(*) as balance_sheet_count FROM public.v_balance_sheet;
SELECT COUNT(*) as cash_flow_count FROM public.v_cash_flow_statement;

-- 5. internal_transfer_pairsビューが正しく動作するか確認
SELECT COUNT(*) as internal_transfer_pairs_count FROM public.internal_transfer_pairs;

-- 6. v_all_transactions_classifiedビューが正しく動作するか確認
SELECT COUNT(*) as classified_count FROM public.v_all_transactions_classified;

-- 7. 関数が存在するか確認
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 8. トリガーが存在するか確認  
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY trigger_name;
