
-- Recreate v_holdings with multi-currency support and correct column names.

-- Drop the existing view AND any dependent objects (like v_holdings_all_currencies).
DROP VIEW IF EXISTS public.v_holdings CASCADE;

-- Recreate the view
CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- CTE 1: Get the latest exchange rates for JPY, EUR, GBP from USD.
latest_rates AS (
    SELECT
        target_currency,
        rate
    FROM (
        SELECT
            target_currency,
            rate,
            -- Rank rates by date for each currency
            ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn
        FROM public.daily_exchange_rates
        WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ) AS ranked_rates
    WHERE rn = 1
),
-- CTE 2: Calculate cost basis from 'BUY' transactions.
acquisitions AS (
    SELECT
        user_id,
        asset,
        sum(value_usd) AS total_cost_basis,
        sum(amount) AS total_amount_acquired
    FROM
        public.v_all_transactions_classified
    WHERE
        transaction_type = 'BUY' AND (usage <> 'internal_transfer' OR usage IS NULL)
    GROUP BY
        user_id,
        asset
),
-- CTE 3: Calculate the current holding quantity of each asset.
current_quantities AS (
    SELECT
        user_id,
        asset,
        sum(
            CASE
                WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN amount
                WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN -amount
                ELSE 0
            END
        ) AS current_amount
    FROM
        public.v_all_transactions_classified
    WHERE
        (transaction_type <> 'INTERNAL_TRANSFER')
    GROUP BY
        user_id,
        asset
)
-- Final SELECT to build the view
SELECT
    cq.user_id,
    cq.asset,
    cq.current_amount,
    ap.current_price AS current_price_usd,
    (cq.current_amount * ap.current_price) AS current_value, -- The required "current_value" column
    (cq.current_amount * ap.current_price) AS current_value_usd, -- Explicit USD value
    -- Add values for other currencies
    (cq.current_amount * ap.current_price * (SELECT rate FROM latest_rates WHERE target_currency = 'JPY')) AS current_value_jpy,
    (cq.current_amount * ap.current_price * (SELECT rate FROM latest_rates WHERE target_currency = 'EUR')) AS current_value_eur,
    (cq.current_amount * ap.current_price * (SELECT rate FROM latest_rates WHERE target_currency = 'GBP')) AS current_value_gbp,
    (cq.current_amount * ap.current_price * (SELECT rate FROM latest_rates WHERE target_currency = 'INR')) AS current_value_inr,
    (cq.current_amount * ap.current_price * (SELECT rate FROM latest_rates WHERE target_currency = 'SGD')) AS current_value_sgd,
    -- P&L columns from the previous version
    COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0) AS "avg_buy_price",
    (cq.current_amount * ap.current_price) - (cq.current_amount * COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0)) AS "unrealized_pnl",
    now() AS last_updated
FROM
    current_quantities cq
-- Join with asset prices (for USD price)
JOIN
    public.asset_prices ap ON cq.asset = ap.asset
-- Left Join for cost basis (some assets might not have a buy history)
LEFT JOIN
    acquisitions acq ON cq.user_id = acq.user_id AND cq.asset = acq.asset
WHERE
    cq.current_amount > 1e-9; -- Filter out dust balances
