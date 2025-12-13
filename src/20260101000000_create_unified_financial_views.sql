-- =================================================================
-- UNIFIED FINANCIAL VIEWS MIGRATION (VERSION 5)
-- FILENAME: 20260101000000_create_unified_financial_views.sql
--
-- PURPOSE:
-- This version introduces a critical fix to ensure all financial
-- reporting calculations are performed in a consistent currency (USD).
-- It replaces all references to acquisition_price_total in the P&L
-- and Balance Sheet with value_in_usd to prevent mixed-currency arithmetic.
-- =================================================================


-- ================================================================
-- STEP 1: Define Row Level Security (RLS) policies for base tables
-- ================================================================

ALTER TABLE public.exchange_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "allow_user_select_own_exchange_trades"
  ON public.exchange_trades;

DROP POLICY IF EXISTS "allow_user_update_own_exchange_trades"
  ON public.exchange_trades;

DROP POLICY IF EXISTS "allow_user_select_own_wallet_transactions"
  ON public.wallet_transactions;

DROP POLICY IF EXISTS "allow_user_update_own_wallet_transactions"
  ON public.wallet_transactions;


-- Create SELECT policies
CREATE POLICY "allow_user_select_own_exchange_trades"
  ON public.exchange_trades
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_user_select_own_wallet_transactions"
  ON public.wallet_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- Create UPDATE policies
CREATE POLICY "allow_user_update_own_exchange_trades"
  ON public.exchange_trades
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_user_update_own_wallet_transactions"
  ON public.wallet_transactions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ================================================================
-- STEP 2: Clean up ALL legacy and conflicting views
-- ================================================================

DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;
DROP VIEW IF EXISTS public.v_profit_and_loss CASCADE;
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;


-- ================================================================
-- STEP 3: Rebuild all views in the correct dependency order
-- ================================================================

-- ================================================================
-- VIEW 1: all_transactions (Unified Foundation)
-- ================================================================

CREATE OR REPLACE VIEW public.all_transactions AS
WITH trades_with_acquisition_price AS (
    SELECT
        *,
        split_part(symbol, '/', 2) AS quote_asset,
        CASE
            WHEN side = 'buy'
                THEN (price * amount) + COALESCE(fee, 0)
            ELSE
                amount - COALESCE(fee, 0)
        END AS acquisition_price_total
    FROM public.exchange_trades
)
SELECT
    ('exchange-' || et.trade_id)::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' ||
    et.symbol || ' @ ' || et.price::text AS description,
    CASE
        WHEN et.side = 'sell'
            THEN et.amount / NULLIF(et.price, 0)
        ELSE et.amount
    END AS amount,
    split_part(et.symbol, '/', 1) AS asset,
    et.quote_asset,
    et.price,
    et.acquisition_price_total,
    CASE
        WHEN et.quote_asset = 'USD'
            THEN et.acquisition_price_total
        ELSE
            et.acquisition_price_total * COALESCE(rates.rate, 0)
    END AS value_in_usd,
    et.side AS type,
    'exchange' AS source,
    et.exchange AS chain,
    et.usage,
    et.note
FROM trades_with_acquisition_price et
LEFT JOIN public.daily_exchange_rates rates
    ON DATE(et.ts) = rates.date
   AND rates.source_currency = et.quote_asset
   AND rates.target_currency = 'USD'

UNION ALL

SELECT
    ('onchain-' || t.id)::text AS id,
    t.user_id,
    t.id::text AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' ||
    COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset,
    'USD' AS quote_asset,
    CASE
        WHEN (t.value_wei / 1e18) <> 0
            THEN t.value_usd / (t.value_wei / 1e18)
        ELSE 0
    END AS price,
    t.value_usd AS acquisition_price_total,
    t.value_usd AS value_in_usd,
    t.direction AS type,
    'on-chain' AS source,
    t.chain_id::text AS chain,
    t.usage,
    t.note
FROM public.wallet_transactions t;


-- ================================================================
-- VIEW 2: v_all_transactions_classified
-- ================================================================

CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
SELECT
    t.*,
    CASE
        WHEN t.type IN ('buy', 'sell')
            THEN UPPER(t.type)
        WHEN t.type ILIKE 'deposit%'
          OR t.type ILIKE 'receive%'
          OR t.type = 'IN'
            THEN 'DEPOSIT'
        WHEN t.type ILIKE 'withdraw%'
          OR t.type ILIKE 'send%'
          OR t.type = 'OUT'
            THEN 'WITHDRAWAL'
        ELSE 'OTHER'
    END AS transaction_type
FROM public.all_transactions t;


-- ================================================================
-- VIEW 3: internal_transfer_pairs
-- ================================================================

CREATE OR REPLACE VIEW public.internal_transfer_pairs AS
WITH ranked_matches AS (
    SELECT
        w.id AS withdrawal_id,
        d.id AS deposit_id,
        ROW_NUMBER() OVER (
            PARTITION BY w.id
            ORDER BY d.date - w.date
        ) AS w_rank,
        ROW_NUMBER() OVER (
            PARTITION BY d.id
            ORDER BY d.date - w.date
        ) AS d_rank
    FROM (
        SELECT *
        FROM public.v_all_transactions_classified
        WHERE transaction_type = 'WITHDRAWAL'
    ) w
    JOIN (
        SELECT *
        FROM public.v_all_transactions_classified
        WHERE transaction_type = 'DEPOSIT'
    ) d
      ON w.user_id = d.user_id
     AND w.asset = d.asset
     AND d.date > w.date
     AND d.date <= (w.date + INTERVAL '2 day')
     AND ABS(w.amount - d.amount) / NULLIF(w.amount, 0) <= 0.002
)
SELECT withdrawal_id AS id
FROM ranked_matches
WHERE w_rank = 1 AND d_rank = 1

UNION

SELECT deposit_id AS id
FROM ranked_matches
WHERE w_rank = 1 AND d_rank = 1;


-- ================================================================
-- VIEW 4: v_holdings
-- ================================================================

CREATE OR REPLACE VIEW public.v_holdings AS
WITH base_calcs AS (
    SELECT
        user_id,
        asset,
        SUM(
            CASE
                WHEN transaction_type IN ('BUY', 'DEPOSIT')
                    THEN COALESCE(amount, 0)
                ELSE 0
            END
        ) AS total_inflow_amount,
        SUM(
            CASE
                WHEN transaction_type IN ('SELL', 'WITHDRAWAL')
                    THEN COALESCE(amount, 0)
                ELSE 0
            END
        ) AS total_outflow_amount,
        SUM(
            CASE
                WHEN transaction_type IN ('BUY', 'DEPOSIT')
                 AND value_in_usd IS NOT NULL
                    THEN COALESCE(value_in_usd, 0)
                ELSE 0
            END
        ) AS total_cost_for_priced_inflows,
        SUM(
            CASE
                WHEN transaction_type IN ('BUY', 'DEPOSIT')
                 AND value_in_usd IS NOT NULL
                    THEN COALESCE(amount, 0)
                ELSE 0
            END
        ) AS total_quantity_of_priced_inflows
    FROM public.v_all_transactions_classified
    WHERE id NOT IN (
        SELECT id FROM public.internal_transfer_pairs
    )
    GROUP BY user_id, asset
)
SELECT
    b.user_id,
    b.asset,
    (b.total_inflow_amount - b.total_outflow_amount) AS current_amount,
    COALESCE(
        (SELECT ap.current_price
         FROM public.asset_prices ap
         WHERE ap.asset = b.asset),
        0
    ) AS current_price,
    (b.total_inflow_amount - b.total_outflow_amount)
        * COALESCE(
            (SELECT ap.current_price
             FROM public.asset_prices ap
             WHERE ap.asset = b.asset),
            0
        ) AS current_value_usd,
    CASE
        WHEN b.total_quantity_of_priced_inflows > 0
            THEN b.total_cost_for_priced_inflows
                 / b.total_quantity_of_priced_inflows
        ELSE 0
    END AS average_buy_price,
    (
        (b.total_inflow_amount - b.total_outflow_amount)
        * COALESCE(
            (SELECT ap.current_price
             FROM public.asset_prices ap
             WHERE ap.asset = b.asset),
            0
        )
    )
    -
    (
        (b.total_inflow_amount - b.total_outflow_amount)
        *
        CASE
            WHEN b.total_quantity_of_priced_inflows > 0
                THEN b.total_cost_for_priced_inflows
                     / b.total_quantity_of_priced_inflows
            ELSE 0
        END
    ) AS capital_gain
FROM base_calcs b
WHERE (b.total_inflow_amount - b.total_outflow_amount) > 0.000001;


-- ================================================================
-- VIEW 5: v_profit_loss_statement (CURRENCY FIX)
-- ================================================================

CREATE OR REPLACE VIEW public.v_profit_loss_statement AS
WITH pnl_items AS (
    SELECT user_id, 'Sales Revenue (IAS 2)' AS account, value_in_usd AS balance
    FROM public.all_transactions
    WHERE usage = 'sale_ias2'
      AND value_in_usd IS NOT NULL

    UNION ALL
    SELECT user_id, 'Consideration Revenue (IFRS 15)', value_in_usd
    FROM public.all_transactions
    WHERE usage = 'revenue_ifrs15'
      AND value_in_usd IS NOT NULL

    UNION ALL
    SELECT user_id, 'Staking & Mining Rewards', value_in_usd
    FROM public.all_transactions
    WHERE usage IN ('mining_rewards', 'staking_rewards')
      AND value_in_usd IS NOT NULL

    UNION ALL
    SELECT user_id, 'Cost of Goods Sold (IAS 2)', -value_in_usd
    FROM public.all_transactions
    WHERE usage = 'sale_ias2'

    UNION ALL
    SELECT user_id,
           'Unrealized Gains on Intangibles (Revaluation)',
           value_in_usd
    FROM public.all_transactions
    WHERE usage = 'revaluation_increase_ias38'

    UNION ALL
    SELECT user_id,
           'Unrealized Losses on Intangibles (Impairment)',
           -value_in_usd
    FROM public.all_transactions
    WHERE usage IN ('impairment_ias38', 'revaluation_decrease_ias38')

    UNION ALL
    SELECT user_id,
           'Realized Gains on Intangibles (Sale)',
           0
    FROM public.all_transactions
    WHERE usage = 'sale_ias38'

    UNION ALL
    SELECT user_id, 'Gas & Network Fees', -value_in_usd
    FROM public.all_transactions
    WHERE usage = 'gas_fees'
      AND value_in_usd IS NOT NULL

    UNION ALL
    SELECT user_id,
           'Loss of Crypto (Unrecoverable)',
           -value_in_usd
    FROM public.all_transactions
    WHERE usage = 'loss_unrecoverable'
      AND value_in_usd IS NOT NULL
)
SELECT
    user_id,
    account,
    SUM(balance) AS balance
FROM pnl_items
WHERE user_id IS NOT NULL
  AND balance IS NOT NULL
GROUP BY user_id, account
ORDER BY user_id, account;


-- ================================================================
-- VIEW 6: v_balance_sheet (CURRENCY FIX)
-- ================================================================

CREATE OR REPLACE VIEW public.v_balance_sheet AS
WITH account_movements AS (
    SELECT
        user_id,
        'Intangible Assets (Investing Crypto)' AS account,
        SUM(value_in_usd) AS balance_change
    FROM public.all_transactions
    WHERE usage IN (
        'investment_acquisition_ias38',
        'mining_rewards',
        'staking_rewards',
        'revenue_ifrs15',
        'revaluation_increase_ias38',
        'crypto_to_crypto_exchange'
    )
    GROUP BY user_id

    UNION ALL
    SELECT
        user_id,
        'Inventory (Trading Crypto)',
        SUM(value_in_usd)
    FROM public.all_transactions
    WHERE usage = 'trading_acquisition_ias2'
    GROUP BY user_id

    UNION ALL
    SELECT
        user_id,
        'Intangible Assets (Investing Crypto)',
        SUM(-value_in_usd)
    FROM public.all_transactions
    WHERE usage IN (
        'sale_ias38',
        'impairment_ias38',
        'loss_unrecoverable',
        'revaluation_decrease_ias38',
        'gas_fees'
    )
    GROUP BY user_id

    UNION ALL
    SELECT
        user_id,
        'Inventory (Trading Crypto)',
        SUM(-value_in_usd)
    FROM public.all_transactions
    WHERE usage IN ('sale_ias2', 'lcnrv_ias2')
    GROUP BY user_id

    UNION ALL
    SELECT
        user_id,
        'Cash & Cash Equivalents',
        SUM(value_in_usd)
    FROM public.all_transactions
    WHERE usage IN ('sale_ias38', 'sale_ias2')
    GROUP BY user_id

    UNION ALL
    SELECT
        user_id,
        'Cash & Cash Equivalents',
        SUM(-value_in_usd)
    FROM public.all_transactions
    WHERE usage IN (
        'investment_acquisition_ias38',
        'trading_acquisition_ias2',
        'crypto_to_crypto_exchange'
    )
    GROUP BY user_id

    UNION ALL
    SELECT
        p.user_id,
        'Retained Earnings',
        SUM(p.balance)
    FROM public.v_profit_loss_statement p
    WHERE p.account <> 'Unrealized Gains on Intangibles (Revaluation)'
    GROUP BY p.user_id

    UNION ALL
    SELECT
        p.user_id,
        'Revaluation Surplus',
        SUM(p.balance)
    FROM public.v_profit_loss_statement p
    WHERE p.account = 'Unrealized Gains on Intangibles (Revaluation)'
    GROUP BY p.user_id
)
SELECT
    m.user_id,
    m.account,
    SUM(m.balance_change) AS balance
FROM account_movements m
WHERE m.account IS NOT NULL
  AND m.balance_change IS NOT NULL
GROUP BY m.user_id, m.account
ORDER BY m.user_id, m.account;


-- ================================================================
-- VIEW 7: v_cash_flow_statement
-- ================================================================

CREATE OR REPLACE VIEW public.v_cash_flow_statement AS
WITH cash_flows AS (
    SELECT
        user_id,
        'Inflow from Sales (IAS 2 & IFRS 15)' AS item,
        SUM(value_in_usd) AS cash_flow
    FROM public.all_transactions
    WHERE usage IN ('sale_ias2', 'revenue_ifrs15')
    GROUP BY user_id

    UNION ALL
    SELECT
        user_id,
        'Outflow for Inventory (IAS 2)',
        SUM(-value_in_usd)
    FROM public.all_transactions
    WHERE usage = 'trading_acquisition_ias2'
    GROUP BY user_id

    UNION ALL
    SELECT
        user_id,
        'Outflow for Gas Fees',
        SUM(-value_in_usd)
    FROM public.all_transactions
    WHERE usage = 'gas_fees'
    GROUP BY user_id

    UNION ALL
    SELECT
        user_id,
        'Outflow for Intangible Assets',
        SUM(-value_in_usd)
    FROM public.all_transactions
    WHERE usage = 'investment_acquisition_ias38'
    GROUP BY user_id

    UNION ALL
    SELECT
        user_id,
        'Inflow from Sale of Intangibles',
        SUM(value_in_usd)
    FROM public.all_transactions
    WHERE usage = 'sale_ias38'
    GROUP BY user_id
)
SELECT
    user_id,
    item,
    SUM(cash_flow) AS amount
FROM cash_flows
WHERE user_id IS NOT NULL
  AND cash_flow IS NOT NULL
GROUP BY user_id, item
ORDER BY
    user_id,
    CASE item
        WHEN 'Inflow from Sales (IAS 2 & IFRS 15)' THEN 1
        WHEN 'Outflow for Inventory (IAS 2)' THEN 2
        WHEN 'Outflow for Gas Fees' THEN 3
        WHEN 'Outflow for Intangible Assets' THEN 4
        WHEN 'Inflow from Sale of Intangibles' THEN 5
        ELSE 99
    END;
