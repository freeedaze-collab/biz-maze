-- ===================================================================
-- 3. ビューの動作確認
-- ===================================================================
-- 重要なビューが正常に動作しているか、データを返すか確認
-- ===================================================================

SELECT 'all_transactions' AS view_name, COUNT(*) AS count 
FROM public.all_transactions
UNION ALL
SELECT 'internal_transfer_pairs', COUNT(*) 
FROM public.internal_transfer_pairs
UNION ALL
SELECT 'v_all_transactions_classified', COUNT(*) 
FROM public.v_all_transactions_classified
UNION ALL
SELECT 'v_holdings', COUNT(*) 
FROM public.v_holdings
UNION ALL
SELECT 'v_profit_loss_statement', COUNT(*) 
FROM public.v_profit_loss_statement
UNION ALL
SELECT 'v_balance_sheet', COUNT(*) 
FROM public.v_balance_sheet
UNION ALL
SELECT 'v_cash_flow_statement', COUNT(*) 
FROM public.v_cash_flow_statement
ORDER BY view_name;
