-- Fix v_holdings empty state by using case-insensitive join on asset_prices.
-- This handles mismatch between 'eth' (transaction) and 'ETH' (prices).

DROP VIEW IF EXISTS public.v_holdings CASCADE;

CREATE OR REPLACE VIEW public.v_holdings WITH (security_invoker = true) AS
WITH
latest_rates AS (
    SELECT DISTINCT ON (target_currency)
        target_currency,
        rate
    FROM public.daily_exchange_rates
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
acquisitions AS (
    SELECT
        user_id,
        asset,
        sum(value_usd) AS total_cost_basis,
        sum(amount) AS total_amount_acquired
    FROM
        public.v_all_transactions_classified
    WHERE
        transaction_type = 'BUY' AND transaction_type <> 'INTERNAL_TRANSFER'
    GROUP BY
        user_id,
        asset
),
current_quantities AS (
    SELECT
        user_id,
        asset,
        sum(
            CASE
                WHEN transaction_type IN ('BUY', 'DEPOSIT', 'IN') THEN amount
                WHEN transaction_type IN ('SELL', 'WITHDRAWAL', 'OUT') THEN -amount
                ELSE 0
            END
        ) AS current_amount
    FROM
        public.v_all_transactions_classified
    WHERE
        transaction_type <> 'INTERNAL_TRANSFER'
    GROUP BY
        user_id,
        asset
)
SELECT
    cq.user_id,
    cq.asset,
    cq.current_amount,
    ap.current_price AS current_price,
    -- Add generic alias just in case
    (cq.current_amount * ap.current_price) AS current_value, 
    (cq.current_amount * ap.current_price) AS current_value_usd,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY'), 1)) AS current_value_jpy,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR'), 1)) AS current_value_eur,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'GBP'), 1)) AS current_value_gbp,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'INR'), 1)) AS current_value_inr,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'SGD'), 1)) AS current_value_sgd,
    COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0) AS "avg_buy_price",
    (cq.current_amount * ap.current_price) - (cq.current_amount * COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0)) AS "unrealized_pnl",
    now() AS last_updated
FROM
    current_quantities cq
-- FIX: Case-insensitive join
JOIN
    public.asset_prices ap ON UPPER(cq.asset) = UPPER(ap.asset)
LEFT JOIN
    acquisitions acq ON cq.user_id = acq.user_id AND cq.asset = acq.asset
WHERE
    cq.current_amount > 1e-9;
