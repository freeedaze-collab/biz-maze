-- =================================================================
-- UNIFIED FINANCIAL VIEWS MIGRATION (VERSION 3)
-- FILENAME: 20260101000000_create_unified_financial_views.sql
-- PURPOSE: This version introduces two major fixes:
-- 1. Correctly calculates the sold crypto amount for exchange 'sell' trades.
-- 2. Adds logic to identify and exclude internal transfers from holdings calculations.
-- =================================================================

-- STEP 1: Define Row Level Security (RLS) policies for base tables.
ALTER TABLE public.exchange_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_user_select_own_exchange_trades" ON public.exchange_trades;
DROP POLICY IF EXISTS "allow_user_select_own_wallet_transactions" ON public.wallet_transactions;

CREATE POLICY "allow_user_select_own_exchange_trades"
  ON public.exchange_trades FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_user_select_own_wallet_transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- STEP 2: Clean up ALL legacy and conflicting views.
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;
DROP VIEW IF EXISTS public.v_profit_and_loss CASCADE; -- Old incorrect name
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;


-- =================================================================
-- STEP 3: Rebuild all views in the correct dependency order.
-- =================================================================

-- VIEW 1: all_transactions (The Unified Foundation)
-- FIX: Correctly calculates asset amount for 'sell' trades.
CREATE OR REPLACE VIEW public.all_transactions AS
WITH trades_with_acquisition_price AS (
    SELECT
        *,
        split_part(symbol, '/', 2) AS quote_asset,
        CASE
            WHEN side = 'buy' THEN (price * amount) + COALESCE(fee, 0)
            -- For sells, the `amount` is the received fiat, so it's the basis for total value.
            ELSE amount - COALESCE(fee, 0)
        END AS acquisition_price_total
    FROM public.exchange_trades
)
-- Exchange Trades
SELECT
    ('exchange-' || et.trade_id)::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    -- CORRECTED LOGIC: For 'sell' trades, `amount` is fiat received. Divide by price to get crypto amount.
    CASE
        WHEN et.side = 'sell' THEN et.amount / NULLIF(et.price, 0)
        ELSE et.amount
    END AS amount,
    split_part(et.symbol, '/', 1) AS asset,
    et.quote_asset,
    et.price,
    et.acquisition_price_total,
    -- Critical: Calculate value_in_usd for financial reports
    CASE
        WHEN et.quote_asset = 'USD' THEN et.acquisition_price_total
        ELSE et.acquisition_price_total * rates.rate
    END AS value_in_usd,
    et.side AS type,
    'exchange' as source,
    et.exchange AS chain,
    et.usage,
    et.note
FROM trades_with_acquisition_price et
LEFT JOIN public.daily_exchange_rates rates
    ON DATE(et.ts) = rates.date
    AND rates.source_currency = et.quote_asset
    AND rates.target_currency = 'USD'

UNION ALL

-- On-chain Transactions
SELECT
    ('onchain-' || t.id)::text as id,
    t.user_id,
    t.id::text as reference_id, -- <<< CRITICAL FIX: Use internal `id` to prevent `bigint` error.
    t.timestamp as date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') as description,
    (t.value_wei / 1e18) as amount,
    COALESCE(t.asset_symbol, 'ETH') as asset,
    'USD' as quote_asset,
    CASE WHEN (t.value_wei / 1e18) <> 0 THEN t.value_usd / (t.value_wei / 1e18) ELSE 0 END as price,
    t.value_usd AS acquisition_price_total,
    t.value_usd AS value_in_usd, -- Critical: Pass through value_in_usd
    t.direction as type,
    'on-chain' as source,
    t.chain_id::text as chain,
    t.usage,
    t.note
FROM public.wallet_transactions t;


-- VIEW 2: v_all_transactions_classified
-- Standardizes transaction types (BUY, SELL, DEPOSIT, WITHDRAWAL)
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
SELECT t.*, CASE
    WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
    WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' OR t.type = 'IN' THEN 'DEPOSIT'
    WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' OR t.type = 'OUT' THEN 'WITHDRAWAL'
    ELSE 'OTHER'
END as transaction_type
FROM public.all_transactions t;


-- VIEW 3: internal_transfer_pairs
-- NEW: Identifies pairs of internal transfers to be excluded from holdings calculations.
CREATE OR REPLACE VIEW public.internal_transfer_pairs AS
WITH ranked_matches AS (
    SELECT
        w.id as withdrawal_id,
        d.id as deposit_id,
        -- Rank matches by time difference to find the best pair for each withdrawal
        ROW_NUMBER() OVER(PARTITION BY w.id ORDER BY d.date - w.date) as w_rank,
        -- Rank matches by time difference to find the best pair for each deposit
        ROW_NUMBER() OVER(PARTITION BY d.id ORDER BY d.date - w.date) as d_rank
    FROM
        (SELECT * FROM public.v_all_transactions_classified WHERE transaction_type = 'WITHDRAWAL') AS w
    JOIN
        (SELECT * FROM public.v_all_transactions_classified WHERE transaction_type = 'DEPOSIT') AS d
    ON
        w.user_id = d.user_id
        AND w.asset = d.asset
        -- Deposit must happen after withdrawal, but within a 2-day window
        AND d.date > w.date
        AND d.date <= (w.date + INTERVAL '2 day')
        -- Amount must be very close (allowing for a 0.2% fee/difference)
        AND abs(w.amount - d.amount) / NULLIF(w.amount, 0) <= 0.002
)
-- Select only the unique, 1-to-1 matches where the pairing is mutual
SELECT withdrawal_id as id FROM ranked_matches WHERE w_rank = 1 AND d_rank = 1
UNION
SELECT deposit_id as id FROM ranked_matches WHERE w_rank = 1 AND d_rank = 1;


-- VIEW 4: v_holdings (Latest logic, now excluding internal transfers)
-- FIX: Excludes internal transfers from the calculation.
CREATE OR REPLACE VIEW public.v_holdings AS
WITH base_calcs AS (
    SELECT
        user_id, asset,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN COALESCE(amount, 0) ELSE 0 END) as total_inflow_amount,
        SUM(CASE WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN COALESCE(amount, 0) ELSE 0 END) as total_outflow_amount,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(value_in_usd, 0) ELSE 0 END) as total_cost_for_priced_inflows,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(amount, 0) ELSE 0 END) as total_quantity_of_priced_inflows
    FROM public.v_all_transactions_classified
    -- Exclude internal transfers from the calculation
    WHERE id NOT IN (SELECT id FROM public.internal_transfer_pairs)
    GROUP BY user_id, asset
)
SELECT
    b.user_id, b.asset,
    (b.total_inflow_amount - b.total_outflow_amount) as current_amount,
    COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0) as current_price,
    (b.total_inflow_amount - b.total_outflow_amount) * COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0) AS current_value_usd,
    (CASE WHEN b.total_quantity_of_priced_inflows > 0 THEN b.total_cost_for_priced_inflows / b.total_quantity_of_priced_inflows ELSE 0 END) as average_buy_price,
    ((b.total_inflow_amount - b.total_outflow_amount) * COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE ap.asset = b.asset), 0)) - ((b.total_inflow_amount - b.total_outflow_amount) * (CASE WHEN b.total_quantity_of_priced_inflows > 0 THEN b.total_cost_for_priced_inflows / b.total_quantity_of_priced_inflows ELSE 0 END)) as capital_gain
FROM base_calcs b
WHERE (b.total_inflow_amount - b.total_outflow_amount) > 0.000001;


-- VIEW 5: v_profit_loss_statement (Correct Name and Logic)
CREATE OR REPLACE VIEW public.v_profit_loss_statement AS
WITH pnl_items AS (
    SELECT user_id, 'Sales Revenue (IAS 2)' AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage = 'sale_ias2' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Consideration Revenue (IFRS 15)' AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage = 'revenue_ifrs15' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Staking & Mining Rewards' AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage IN ('mining_rewards', 'staking_rewards') AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Cost of Goods Sold (IAS 2)' AS account, -acquisition_price_total AS balance FROM public.all_transactions WHERE usage = 'sale_ias2' AND acquisition_price_total IS NOT NULL
    UNION ALL
    SELECT user_id, 'Unrealized Gains on Intangibles (Revaluation)' as account, value_in_usd as balance from public.all_transactions where usage = 'revaluation_increase_ias38'
    UNION ALL
    SELECT user_id, 'Unrealized Losses on Intangibles (Impairment)' as account, -value_in_usd as balance from public.all_transactions where usage in ('impairment_ias38', 'revaluation_decrease_ias38')
    UNION ALL
    SELECT user_id, 'Realized Gains on Intangibles (Sale)' as account, (value_in_usd - acquisition_price_total) as balance from public.all_transactions where usage = 'sale_ias38'
    UNION ALL
    SELECT user_id, 'Gas & Network Fees' AS account, -value_in_usd AS balance FROM public.all_transactions WHERE usage = 'gas_fees' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Loss of Crypto (Unrecoverable)' AS account, -value_in_usd AS balance FROM public.all_transactions WHERE usage = 'loss_unrecoverable' AND value_in_usd IS NOT NULL
)
SELECT
    user_id,
    account,
    SUM(balance) AS balance
FROM pnl_items
WHERE user_id IS NOT NULL AND balance IS NOT NULL
GROUP BY user_id, account
ORDER BY user_id, account;


-- VIEW 6: v_balance_sheet (Depends on correct P&L name)
CREATE OR REPLACE VIEW public.v_balance_sheet AS
WITH account_movements AS (
    -- ASSETS
    SELECT user_id, 'Intangible Assets (Investing Crypto)' AS account, SUM(value_in_usd) as balance_change FROM public.all_transactions WHERE usage IN ('investment_acquisition_ias38', 'mining_rewards', 'staking_rewards', 'revenue_ifrs15', 'revaluation_increase_ias38') GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Inventory (Trading Crypto)' AS account, SUM(value_in_usd) as balance_change FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Intangible Assets (Investing Crypto)' AS account, SUM(-acquisition_price_total) as balance_change FROM public.all_transactions WHERE usage = 'sale_ias38' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Inventory (Trading Crypto)' AS account, SUM(-acquisition_price_total) as balance_change FROM public.all_transactions WHERE usage = 'sale_ias2' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Intangible Assets (Investing Crypto)' AS account, SUM(-value_in_usd) as balance_change FROM public.all_transactions WHERE usage IN ('impairment_ias38', 'loss_unrecoverable', 'revaluation_decrease_ias38', 'gas_fees') GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Inventory (Trading Crypto)' AS account, SUM(-value_in_usd) as balance_change FROM public.all_transactions WHERE usage = 'lcnrv_ias2' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Cash & Cash Equivalents' AS account, SUM(value_in_usd) as balance_change FROM public.all_transactions WHERE usage IN ('sale_ias38', 'sale_ias2') GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Cash & Cash Equivalents' AS account, SUM(-value_in_usd) as balance_change FROM public.all_transactions WHERE usage IN ('investment_acquisition_ias38', 'trading_acquisition_ias2') GROUP BY user_id

    -- EQUITY
    UNION ALL
    SELECT p.user_id, 'Retained Earnings' AS account, SUM(p.balance) AS balance_change
    FROM public.v_profit_loss_statement p -- Correct dependency
    WHERE p.account not in ('Unrealized Gains on Intangibles (Revaluation)')
    GROUP BY p.user_id
    UNION ALL
    SELECT p.user_id, 'Revaluation Surplus' AS account, SUM(p.balance) AS balance_change
    FROM public.v_profit_loss_statement p -- Correct dependency
    WHERE p.account = 'Unrealized Gains on Intangibles (Revaluation)'
    GROUP BY p.user_id
)
SELECT
    m.user_id,
    m.account,
    SUM(m.balance_change) AS balance
FROM account_movements m
WHERE m.account IS NOT NULL AND m.balance_change IS NOT NULL
GROUP BY m.user_id, m.account
ORDER BY user_id, account;


-- VIEW 7: v_cash_flow_statement
CREATE OR REPLACE VIEW public.v_cash_flow_statement AS
WITH cash_flows AS (
    -- Operating Activities
    SELECT user_id, 'Inflow from Sales (IAS 2 & IFRS 15)' as item, SUM(value_in_usd) as cash_flow FROM public.all_transactions WHERE usage IN ('sale_ias2', 'revenue_ifrs15') GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Outflow for Inventory (IAS 2)' as item, SUM(-value_in_usd) as cash_flow FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Outflow for Gas Fees' as item, SUM(-value_in_usd) as cash_flow FROM public.all_transactions WHERE usage = 'gas_fees' GROUP BY user_id

    -- Investing Activities
    UNION ALL
    SELECT user_id, 'Outflow for Intangible Assets' as item, SUM(-value_in_usd) as cash_flow FROM public.all_transactions WHERE usage = 'investment_acquisition_ias38' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Inflow from Sale of Intangibles' as item, SUM(value_in_usd) as cash_flow FROM public.all_transactions WHERE usage = 'sale_ias38' GROUP BY user_id
)
SELECT
    user_id,
    item,
    SUM(cash_flow) as amount
FROM cash_flows
WHERE user_id IS NOT NULL AND cash_flow IS NOT NULL
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
