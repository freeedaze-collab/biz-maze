-- ===================================================================
-- 6. ビューの完全な定義取得
-- ===================================================================
-- 重要なビューの定義を取得
-- ローカル開発環境と比較して、差分を確認できます
-- ===================================================================

-- all_transactionsビューの定義
SELECT pg_get_viewdef('public.all_transactions', true) AS view_definition;

-- 他のビューを確認したい場合は、上記のクエリのテーブル名を変更して実行してください
-- 例:
-- SELECT pg_get_viewdef('public.v_holdings', true) AS view_definition;
-- SELECT pg_get_viewdef('public.v_all_transactions_classified', true) AS view_definition;
