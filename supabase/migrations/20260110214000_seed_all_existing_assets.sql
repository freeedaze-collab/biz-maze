-- Seed ALL assets found in wallet_transactions into asset_prices.
-- This ensures that the v_holdings INNER JOIN finds a match for every user asset,
-- even if we don't have a known price for it yet (defaults to 0).

INSERT INTO public.asset_prices (asset, current_price, last_updated)
SELECT DISTINCT 
    COALESCE(asset_symbol, 'ETH'), -- Handle nulls if any
    0, -- Default price 0, will be updated by sync-prices job if supported
    now()
FROM public.wallet_transactions
WHERE asset_symbol IS NOT NULL
ON CONFLICT (asset) DO NOTHING;

-- Also check exchange trades
INSERT INTO public.asset_prices (asset, current_price, last_updated)
SELECT DISTINCT 
    split_part(symbol, '/', 1),
    0,
    now()
FROM public.exchange_trades
WHERE symbol IS NOT NULL
ON CONFLICT (asset) DO NOTHING;

-- Ensure permissions are correct (RLS could be blocking the view)
ALTER TABLE public.asset_prices ENABLE ROW LEVEL SECURITY;

-- Policy: Allow everyone to read prices (global data)
DROP POLICY IF EXISTS "Read access for all users" ON public.asset_prices;
CREATE POLICY "Read access for all users" ON public.asset_prices
    FOR SELECT
    USING (true);

-- Grant access
GRANT SELECT ON public.asset_prices TO anon, authenticated, service_role;
