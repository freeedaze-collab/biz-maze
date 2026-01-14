-- Fix v_holdings calculation logic.
-- PREVIOUS BUG: The view relied on 'transaction_type' (which can be 'MINING_REWARDS', etc.) matching strict 'BUY'/'DEPOSIT'.
-- FIX: Use the base 'type' column (IN/OUT/BUY/SELL) for quantity calculations, ensuring all inflows are counted regardless of usage label.

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
        -- For Cost Basis, we typically only care about BUYS or explicit acquisitions
        (transaction_type = 'BUY' OR usage IN ('mining_rewards', 'staking_rewards', 'airdrop', 'income'))
        AND transaction_type <> 'INTERNAL_TRANSFER'
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
                -- LOGIC FIX: Check base 'type' (normalized direction) for quantity changes
                -- This catches all 'in', 'receive', 'deposit', 'buy' regardless of usage label (e.g. 'mining_rewards')
                WHEN UPPER(type) IN ('IN', 'DEPOSIT', 'BUY', 'RECEIVE') THEN amount
                WHEN UPPER(type) IN ('OUT', 'WITHDRAWAL', 'SELL', 'SEND') THEN -amount
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
-- Keep robust join Logic
JOIN
    public.asset_prices ap ON TRIM(UPPER(cq.asset)) = TRIM(UPPER(ap.asset))
LEFT JOIN
    acquisitions acq ON cq.user_id = acq.user_id AND cq.asset = acq.asset
WHERE
    cq.current_amount > 1e-9; -- Filters 0 balances

GRANT SELECT ON public.v_holdings TO authenticated;
GRANT SELECT ON public.v_holdings TO service_role;
