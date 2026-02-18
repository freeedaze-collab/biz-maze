-- 重要なビュー定義の詳細確認
-- これらの結果を本番環境と比較してください

-- 1. all_transactionsビューの定義
\echo '=== ALL_TRANSACTIONS VIEW DEFINITION ==='
SELECT pg_get_viewdef('public.all_transactions', true);

-- 2. v_holdingsビューの定義
\echo '=== V_HOLDINGS VIEW DEFINITION ==='
SELECT pg_get_viewdef('public.v_holdings', true);

-- 3. internal_transfer_pairsビューの定義
\echo '=== INTERNAL_TRANSFER_PAIRS VIEW DEFINITION ==='
SELECT pg_get_viewdef('public.internal_transfer_pairs', true);

-- 4. v_all_transactions_classifiedビューの定義
\echo '=== V_ALL_TRANSACTIONS_CLASSIFIED VIEW DEFINITION ==='
SELECT pg_get_viewdef('public.v_all_transactions_classified', true);

-- 5. v_profit_loss_statementビューの定義
\echo '=== V_PROFIT_LOSS_STATEMENT VIEW DEFINITION ==='
SELECT pg_get_viewdef('public.v_profit_loss_statement', true);
