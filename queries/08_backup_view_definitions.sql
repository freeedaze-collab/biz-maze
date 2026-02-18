-- ===================================================================
-- 完全バックアップ用: 全ビュー定義の取得
-- ===================================================================
-- このクエリを実行して、結果を全てコピーして保存してください
-- ===================================================================

-- 重要: 各ビューを個別に実行してください（一度に実行すると最後の結果のみ表示されます）

-- 1. all_transactions ビュー
SELECT pg_get_viewdef('public.all_transactions', true) AS view_definition;

-- 2. v_all_transactions_classified ビュー
-- SELECT pg_get_viewdef('public.v_all_transactions_classified', true) AS view_definition;

-- 3. internal_transfer_pairs ビュー
-- SELECT pg_get_viewdef('public.internal_transfer_pairs', true) AS view_definition;

-- 4. v_holdings ビュー
-- SELECT pg_get_viewdef('public.v_holdings', true) AS view_definition;

-- 5. v_balance_sheet ビュー
-- SELECT pg_get_viewdef('public.v_balance_sheet', true) AS view_definition;

-- 6. v_profit_loss_statement ビュー
-- SELECT pg_get_viewdef('public.v_profit_loss_statement', true) AS view_definition;

-- 7. v_cash_flow_statement ビュー
-- SELECT pg_get_viewdef('public.v_cash_flow_statement', true) AS view_definition;

-- ===================================================================
-- 実行方法:
-- 1. 1つ目のSELECTのコメントを外して実行
-- 2. 結果をコピーして保存
-- 3. 次のSELECTのコメントを外して実行
-- 4. 全てのビューについて繰り返す
-- ===================================================================
