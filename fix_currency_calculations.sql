-- 解決策1: 本番環境のマスターデータをインポート
-- これを開発環境のSQL Editorで実行してください

-- ステップ1: 本番環境から為替レートデータをコピー
-- (本番環境のSQL Editorで実行してデータを取得)
-- SELECT * FROM public.daily_exchange_rates ORDER BY date DESC LIMIT 100;

-- ステップ2: 本番環境から資産価格データをコピー  
-- (本番環境のSQL Editorで実行してデータを取得)
-- SELECT * FROM public.asset_prices;

-- 上記のデータを取得したら、以下の形式でINSERT文を生成して開発環境で実行
-- INSERT INTO public.daily_exchange_rates (date, source_currency, target_currency, rate, created_at) VALUES (...);
-- INSERT INTO public.asset_prices (asset, current_price, last_updated) VALUES (...);

-- 一時的な対処として、基本的な為替レートを手動で追加
INSERT INTO public.daily_exchange_rates (date, source_currency, target_currency, rate, created_at) VALUES
-- USD to JPY
(CURRENT_DATE, 'USD', 'JPY', 152.00, NOW()),
(CURRENT_DATE - INTERVAL '1 day', 'USD', 'JPY', 152.00, NOW()),
-- USD to EUR
(CURRENT_DATE, 'USD', 'EUR', 0.94, NOW()),
(CURRENT_DATE - INTERVAL '1 day', 'USD', 'EUR', 0.94, NOW()),
-- BTC to USD
(CURRENT_DATE, 'BTC', 'USD', 105000.00, NOW()),
(CURRENT_DATE - INTERVAL '1 day', 'BTC', 'USD', 105000.00, NOW()),
-- ETH to USD
(CURRENT_DATE, 'ETH', 'USD', 3300.00, NOW()),
(CURRENT_DATE - INTERVAL '1 day', 'ETH', 'USD', 3300.00, NOW()),
-- SOL to USD
(CURRENT_DATE, 'SOL', 'USD', 240.00, NOW()),
(CURRENT_DATE - INTERVAL '1 day', 'SOL', 'USD', 240.00, NOW())
ON CONFLICT DO NOTHING;

-- 資産価格も追加
INSERT INTO public.asset_prices (asset, current_price, last_updated) VALUES
('BTC', 105000.00, NOW()),
('ETH', 3300.00, NOW()),
('SOL', 240.00, NOW()),
('USDT', 1.00, NOW()),
('USDC', 1.00, NOW())
ON CONFLICT (asset) DO UPDATE SET
  current_price = EXCLUDED.current_price,
  last_updated = EXCLUDED.last_updated;

-- 検証: データが入ったか確認
SELECT 'daily_exchange_rates' as table_name, COUNT(*) as count FROM public.daily_exchange_rates
UNION ALL
SELECT 'asset_prices', COUNT(*) FROM public.asset_prices;
