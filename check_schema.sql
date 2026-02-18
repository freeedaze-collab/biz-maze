-- Check if all critical views and tables exist in development database

-- Check for critical views
SELECT 
    'all_transactions' as view_name,
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'all_transactions') as exists
UNION ALL
SELECT 
    'internal_transfer_pairs',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'internal_transfer_pairs')
UNION ALL
SELECT 
    'v_all_transactions_classified',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_all_transactions_classified')
UNION ALL
SELECT 
    'v_holdings',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_holdings')
UNION ALL
SELECT 
    'v_profit_loss_statement',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_profit_loss_statement')
UNION ALL
SELECT 
    'v_balance_sheet',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_balance_sheet')
UNION ALL
SELECT 
    'v_cash_flow_statement',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_cash_flow_statement');

-- Check for critical tables mentioned in diff
SELECT 
    'exchange_accounts' as table_name,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exchange_accounts') as exists
UNION ALL
SELECT 
    'wallets',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wallets')
UNION ALL
SELECT 
    'internal_transfer_links',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'internal_transfer_links')
UNION ALL
SELECT 
    'wallet_nonces',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wallet_nonces');
