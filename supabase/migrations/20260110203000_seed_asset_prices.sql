-- Seed asset_prices from daily_exchange_rates to ensure v_holdings has data.
-- v_holdings uses INNER JOIN on asset_prices, so this table MUST be populated.

INSERT INTO public.asset_prices (asset, current_price, last_updated)
SELECT 
    source_currency AS asset, 
    rate AS current_price, 
    now() AS last_updated
FROM public.daily_exchange_rates
WHERE target_currency = 'USD' 
  AND date = '2025-12-07' -- Use the latest seeded date
ON CONFLICT (asset) 
DO UPDATE SET 
    current_price = EXCLUDED.current_price,
    last_updated = EXCLUDED.last_updated;

-- Also seed some static values if they might be missing from rates but present in wallet
INSERT INTO public.asset_prices (asset, current_price, last_updated)
VALUES
    ('ETH', 3600.00, now()),
    ('BTC', 98000.00, now()),
    ('MATIC', 1.25, now()),
    ('USDC', 1.00, now()),
    ('USDT', 1.00, now()),
    ('AVAX', 48.00, now()),
    ('BNB', 660.00, now())
ON CONFLICT (asset) DO NOTHING;
