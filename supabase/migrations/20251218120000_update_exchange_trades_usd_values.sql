-- supabase/migrations/20251218_update_exchange_trades_usd_values.sql

-- public.exchange_trades テーブルの value_usd と price を更新する
WITH trades_with_rates AS (
    SELECT
        et.id AS trade_id,
        (
            SELECT er.rate
            FROM public.daily_exchange_rates er
            WHERE er.source_currency = et.symbol
              AND er.target_currency = 'USD'
              AND er.date <= DATE(et.ts) -- 取引日以前の最新レートを取得
            ORDER BY er.date DESC
            LIMIT 1
        ) AS retrieved_rate,
        et.amount
    FROM
        public.exchange_trades et
    WHERE
        et.value_usd IS NULL -- value_usd が NULL の行のみを対象
        AND (et.side = 'withdrawal' OR et.side = 'deposit') -- 出金と入金に限定
)
UPDATE public.exchange_trades AS et
SET
    value_usd = twr.retrieved_rate * twr.amount,
    price = twr.retrieved_rate
FROM
    trades_with_rates twr
WHERE
    et.id = twr.trade_id
    AND twr.retrieved_rate IS NOT NULL; -- レートが取得できた行のみを更新
