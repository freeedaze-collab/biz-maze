-- supabase/migrations/20240523120000_consolidated_views_rebuild.sql
-- PURPOSE: Consolidates all core financial views into a single, ordered file.
-- VERSION: 20

-- Step 1: Safely drop views in reverse order of dependency.
-- Financial statements are dropped first as they depend on the lower-level views.
DROP VIEW IF EXISTS public.v_profit_and_loss CASCADE;
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE; -- Added for completeness
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;


-- =================================================================
-- VIEW 1: all_transactions
-- The foundational view combining exchange and on-chain transactions.
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions AS
-- Exchange Trades
WITH trades_with_acquisition_price AS (
    SELECT
        *,
        split_part(symbol, '/', 2) AS quote_asset,
        CASE
            WHEN side = 'buy' THEN (price * amount) + COALESCE(fee, 0)
            WHEN side = 'sell' THEN amount - COALESCE(fee, 0)
            ELSE NULL
        END AS acquisition_price_total
    FROM public.exchange_trades
)
SELECT
    ('exchange-' || et.trade_id)::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    CASE
        WHEN et.side = 'buy' THEN et.amount
        WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price
        ELSE et.amount
    END AS amount,
    split_part(et.symbol, '/', 1) AS asset,
    et.quote_asset,
    et.price,
    et.acquisition_price_total,
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
    t.id::text as reference_id,
    t.timestamp as date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') as description,
    (t.value_wei / 1e18) as amount,
    COALESCE(t.asset_symbol, 'ETH') as asset,
    'USD' as quote_asset,
    CASE WHEN (t.value_wei / 1e18) <> 0 THEN t.value_usd / (t.value_wei / 1e18) ELSE 0 END as price,
    t.value_usd AS acquisition_price_total,
    t.value_usd AS value_in_usd,
    t.direction as type,
    'on-chain' as source,
    t.chain_id::text as chain,
    t.usage,
    t.note
FROM public.wallet_transactions t;


-- =================================================================
-- VIEW 2: v_all_transactions_classified
-- Classifies transactions into standard types (BUY, SELL, DEPOSIT, etc.).
-- =================================================================
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
SELECT t.*, CASE
    WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
    WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' OR t.type = 'IN' THEN 'DEPOSIT'
    WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' OR t.type = 'OUT' THEN 'WITHDRAWAL'
    ELSE 'OTHER'
END as transaction_type
FROM public.all_transactions t;


-- =================================================================
-- VIEW 3: v_holdings
-- Calculates current asset holdings and unrealized P&L.
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS
WITH base_calcs AS (
    SELECT
        user_id, asset,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN COALESCE(amount, 0) ELSE 0 END) as total_inflow_amount,
        SUM(CASE WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN COALESCE(amount, 0) ELSE 0 END) as total_outflow_amount,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(value_in_usd, 0) ELSE 0 END) as total_cost_for_priced_inflows,
        SUM(CASE WHEN transaction_type IN ('BUY', 'DEPOSIT') AND value_in_usd IS NOT NULL THEN COALESCE(amount, 0) ELSE 0 END) as total_quantity_of_priced_inflows
    FROM public.v_all_transactions_classified
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


-- =================================================================
-- VIEW 4: v_profit_and_loss (Profit and Loss Statement)
-- Translates transaction usages into P&L accounts according to IFRS.
-- =================================================================
CREATE OR REPLACE VIEW public.v_profit_and_loss AS
WITH pnl_items AS (
    -- Revenue & Other Income
    SELECT user_id, 'Sales Revenue (IAS 2)' AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage = 'sale_ias2' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Consideration Revenue (IFRS 15)' AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage = 'revenue_ifrs15' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, 'Staking & Mining Rewards' AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage IN ('mining_rewards', 'staking_rewards') AND value_in_usd IS NOT NULL
    UNION ALL
    -- Cost of Sales (approximated as acquisition_price_total)
    SELECT user_id, 'Cost of Goods Sold (IAS 2)' AS account, -acquisition_price_total AS balance FROM public.all_transactions WHERE usage = 'sale_ias2' AND acquisition_price_total IS NOT NULL
    UNION ALL
    -- Gains & Losses
    SELECT user_id, 'Unrealized Gains on Intangibles (Revaluation)' as account, value_in_usd as balance from public.all_transactions where usage = 'revaluation_increase_ias38'
    UNION ALL
    SELECT user_id, 'Unrealized Losses on Intangibles (Impairment)' as account, -value_in_usd as balance from public.all_transactions where usage in ('impairment_ias38', 'revaluation_decrease_ias38')
    UNION ALL
    SELECT user_id, 'Realized Gains on Intangibles (Sale)' as account, (value_in_usd - acquisition_price_total) as balance from public.all_transactions where usage = 'sale_ias38'
    UNION ALL
    -- Expenses
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


-- =================================================================
-- VIEW 5: v_balance_sheet (Balance Sheet)
-- Tracks the balances of Assets, Liabilities, and Equity accounts.
-- =================================================================
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
    FROM public.v_profit_and_loss p
    WHERE p.account not in ('Unrealized Gains on Intangibles (Revaluation)') -- Revaluation surplus goes to OCI, not Retained Earnings
    GROUP BY p.user_id
    UNION ALL
    SELECT p.user_id, 'Revaluation Surplus' AS account, SUM(p.balance) AS balance_change
    FROM public.v_profit_and_loss p
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

-- =================================================================
-- VIEW 6: v_cash_flow_statement (Cash Flow Statement)
-- =================================================================
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
        -- Operating
        WHEN 'Inflow from Sales (IAS 2 & IFRS 15)' THEN 1
        WHEN 'Outflow for Inventory (IAS 2)' THEN 2
        WHEN 'Outflow for Gas Fees' THEN 3
        -- Investing
        WHEN 'Outflow for Intangible Assets' THEN 4
        WHEN 'Inflow from Sale of Intangibles' THEN 5
        ELSE 99
    END;
