-- Final Diagnostic: ETH & USDC Investigation
-- Run this to find why ETH/USDC balances are incorrect.

-- 1. Detailed ETH transaction list (Ordered by impact)
SELECT date, description, amount, asset, type, source, value_usd, entity_name
FROM public.v_all_transactions_classified
WHERE asset = 'ETH'
ORDER BY ABS(amount) DESC
LIMIT 50;

-- 2. USDC Homoglyph Breakdown
-- This shows all assets that look like USDC
SELECT 
    asset, 
    COUNT(*) as tx_count, 
    SUM(CASE WHEN UPPER(type) IN ('IN', 'DEPOSIT', 'BUY', 'RECEIVE') THEN amount ELSE -amount END) as balance
FROM public.v_all_transactions_classified
WHERE asset ILIKE '%USD%' OR asset ILIKE '%USDC%'
GROUP BY 1
ORDER BY 1;

-- 3. Check for ETH "Sell" orders in raw exchange_trades
-- We want to see if amount and price are consistent
SELECT ts, symbol, side, amount, price, fee, fee_currency
FROM public.exchange_trades
WHERE symbol ILIKE '%ETH%' AND side = 'sell'
ORDER BY ts DESC;
