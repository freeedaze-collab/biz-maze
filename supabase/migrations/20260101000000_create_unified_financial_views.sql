-- =================================================================
-- UNIFIED FINANCIAL VIEWS MIGRATION
-- FILENAME: 20260101000000_create_unified_financial_views.sql
-- PURPOSE: This is the single source of truth for all financial reporting views.
-- It resolves historical conflicts, fixes all known bugs (bigint, RLS, view names),
-- and consolidates all necessary logic into one file.
-- =================================================================

-- STEP 1: Define Row Level Security (RLS) policies for base tables.
-- This ensures that views can only access data belonging to the currently authenticated user.
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
-- The CASCADE option ensures a completely clean slate for rebuilding.
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
-- This version implements correct double-entry accounting for exchange trades.
CREATE OR REPLACE VIEW public.all_transactions AS
WITH unified_trades AS (
    -- Process exchange trades into a standardized debit/credit format
    SELECT
        et.user_id,
        ('exchange-' || et.trade_id)::text AS id,
        et.ts AS date,
        et.side,
        CASE
            WHEN et.side = 'buy' THEN 'Purchase of ' || et.amount::text || ' ' || split_part(et.symbol, '/', 1)
            ELSE 'Sale of ' || et.amount::text || ' ' || split_part(et.symbol, '/', 1)
        END AS description,

        -- DEBIT: What you received.
        CASE
            WHEN et.side = 'buy' THEN abs(et.amount) -- You receive the base asset
            ELSE et.price * et.amount -- You receive the quote asset value (proceeds)
        END AS debit_amount,
        CASE
            WHEN et.side = 'buy' THEN split_part(et.symbol, '/', 1) -- The base asset (e.g., BTC)
            ELSE split_part(et.symbol, '/', 2) -- The quote asset (e.g., JPY)
        END AS debit_asset,

        -- CREDIT: What you gave away.
        CASE
            WHEN et.side = 'buy' THEN et.price * et.amount -- You give the quote asset value (cost)
            ELSE abs(et.amount) -- You give the base asset
        END AS credit_amount,
        CASE
            WHEN et.side = 'buy' THEN split_part(et.symbol, '/', 2) -- The quote asset (e.g., JPY)
            ELSE split_part(et.symbol, '/', 1) -- The base asset (e.g., BTC)
        END AS credit_asset,

        -- Metadata
        et.usage,
        et.note,
        'exchange' as source,
        et.exchange AS chain
    FROM public.exchange_trades et

    UNION ALL

    -- Process on-chain transactions (already in a debit/credit-like format)
    SELECT
        wt.user_id,
        ('onchain-' || wt.id)::text as id,
        wt.timestamp as date,
        wt.direction as side,
        'On-chain: ' || wt.direction || ' ' || COALESCE(wt.asset_symbol, 'ETH') as description,
        -- DEBIT: For 'in' txs, this is the asset received
        CASE WHEN wt.direction = 'in' THEN (wt.value_wei / 1e18) ELSE NULL END as debit_amount,
        CASE WHEN wt.direction = 'in' THEN COALESCE(wt.asset_symbol, 'ETH') ELSE NULL END as debit_asset,
        -- CREDIT: For 'out' txs, this is the asset sent
        CASE WHEN wt.direction = 'out' THEN (wt.value_wei / 1e18) ELSE NULL END as credit_amount,
        CASE WHEN wt.direction = 'out' THEN COALESCE(wt.asset_symbol, 'ETH') ELSE NULL END as credit_asset,
        wt.usage,
        wt.note,
        'on-chain' as source,
        wt.chain_id::text as chain
    FROM public.wallet_transactions wt
)
SELECT
    t.user_id,
    t.id,
    t.date,
    t.side,
    t.description,
    t.debit_amount,
    t.debit_asset,
    t.credit_amount,
    t.credit_asset,
    -- Calculate value_in_usd based on the DEBIT side (what you received) for simplicity.
    -- This may need refinement if the credit side has a more reliable USD price.
    COALESCE(
        (SELECT t.debit_amount * rates.rate
         FROM public.daily_exchange_rates rates
         WHERE DATE(t.date) = rates.date
           AND t.debit_asset = rates.source_currency
           AND rates.target_currency = 'USD'),
        -- If no direct rate, check if the credit side is USD to infer value
        (CASE WHEN t.credit_asset = 'USD' THEN t.credit_amount ELSE 0 END)
    ) AS value_in_usd,
    t.usage,
    t.note,
    t.source,
    t.chain
FROM unified_trades t;



-- VIEW 2: v_all_transactions_classified
-- This view unnests the debit/credit structure into individual movements for easier analysis.
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
-- Debits (Inflows/Receipts)
SELECT
    id,
    user_id,
    date,
    debit_asset AS asset,
    debit_amount AS amount,
    value_in_usd,
    'DEBIT' AS movement_type, -- Indicates an increase in asset holding
    side as transaction_type,
    source,
    chain,
    usage,
    note
FROM public.all_transactions
WHERE debit_amount IS NOT NULL AND debit_asset IS NOT NULL

UNION ALL

-- Credits (Outflows/Disposals)
SELECT
    id,
    user_id,
    date,
    credit_asset AS asset,
    -credit_amount AS amount, -- Negative sign indicates a decrease in asset holding
    -- We negate the value_in_usd from the original transaction (which was based on the DEBIT side)
    -- This is an approximation. For perfect accuracy, we'd need to price the credit side separately.
    -value_in_usd AS value_in_usd,
    'CREDIT' AS movement_type, -- Indicates a decrease in asset holding
    side as transaction_type,
    source,
    chain,
    usage,
    note
FROM public.all_transactions
WHERE credit_amount IS NOT NULL AND credit_asset IS NOT NULL;



-- VIEW 3: v_holdings (Simplified to use the new classified view)
-- This now correctly calculates balances by summing all DEBITs (+) and CREDITs (-).
CREATE OR REPLACE VIEW public.v_holdings AS
WITH balances AS (
    SELECT
        user_id,
        asset,
        SUM(amount) AS current_amount,
        -- Correctly calculate total cost basis from DEBIT (inflow) movements
        SUM(CASE WHEN amount > 0 THEN value_in_usd ELSE 0 END) as total_cost_basis,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_quantity_purchased
    FROM public.v_all_transactions_classified
    GROUP BY user_id, asset
)
SELECT
    b.user_id,
    b.asset,
    b.current_amount,
    COALESCE(ap.current_price, 0) as current_price,
    (b.current_amount * COALESCE(ap.current_price, 0)) AS current_value_usd,
    -- Calculate Average Buy Price
    CASE
        WHEN b.total_quantity_purchased > 0 THEN b.total_cost_basis / b.total_quantity_purchased
        ELSE 0
    END as average_buy_price,
    -- Calculate Unrealized Capital Gain
    (b.current_amount * COALESCE(ap.current_price, 0)) - (b.current_amount *
        (CASE WHEN b.total_quantity_purchased > 0 THEN b.total_cost_basis / b.total_quantity_purchased ELSE 0 END)
    ) as capital_gain
FROM balances b
LEFT JOIN public.asset_prices ap ON b.asset = ap.asset
WHERE b.current_amount > 1e-9; -- Use a small threshold to avoid floating point dust



-- VIEW 4: v_profit_loss_statement (Adapted for the new debit/credit structure)
CREATE OR REPLACE VIEW public.v_profit_loss_statement AS
WITH pnl_base AS (
    -- Revenue from Sales (value of what you received)
    SELECT
        user_id,
        'Sales Revenue' as account,
        SUM(value_in_usd) as balance
    FROM public.v_all_transactions_classified
    WHERE usage IN ('sale_ias2', 'sale_ias38') AND movement_type = 'DEBIT'
    GROUP BY user_id

    UNION ALL

    -- Cost of Goods Sold (value of what you gave away)
    SELECT
        user_id,
        'Cost of Goods Sold' as account,
        SUM(value_in_usd) as balance -- value_in_usd is already negative for CREDITs
    FROM public.v_all_transactions_classified
    WHERE usage IN ('sale_ias2', 'sale_ias38') AND movement_type = 'CREDIT'
    GROUP BY user_id

    -- Other usages mapped to P&L accounts
    UNION ALL
    SELECT user_id, 'Staking & Mining Rewards' AS account, SUM(value_in_usd) AS balance FROM public.v_all_transactions_classified WHERE usage IN ('mining_rewards', 'staking_rewards') AND movement_type = 'DEBIT' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Gas & Network Fees' AS account, SUM(value_in_usd) AS balance FROM public.v_all_transactions_classified WHERE usage = 'gas_fees' GROUP BY user_id
    UNION ALL
    SELECT user_id, 'Loss of Crypto (Unrecoverable)' AS account, SUM(value_in_usd) AS balance FROM public.v_all_transactions_classified WHERE usage = 'loss_unrecoverable' GROUP BY user_id
)
SELECT
    user_id,
    account,
    SUM(balance) AS balance
FROM pnl_base
GROUP BY user_id, account
ORDER BY user_id, account;


-- VIEW 5: v_balance_sheet (This view becomes much simpler and more accurate)
CREATE OR REPLACE VIEW public.v_balance_sheet AS
-- Asset side of the sheet
SELECT
    user_id,
    asset as account,
    current_value_usd as balance
FROM public.v_holdings
WHERE current_value_usd <> 0

UNION ALL

-- Equity side of the sheet (example, needs full equity accounting)
SELECT
    user_id,
    'Retained Earnings' as account,
    SUM(balance) as balance
FROM public.v_profit_loss_statement
GROUP BY user_id;


-- VIEW 6: v_cash_flow_statement (Simplified using the new structure)
CREATE OR REPLACE VIEW public.v_cash_flow_statement AS
SELECT
    user_id,
    usage as item,
    SUM(value_in_usd) as amount
FROM public.v_all_transactions_classified
WHERE usage IN (
    'sale_ias2', -- Inflow from operating activities
    'revenue_ifrs15', -- Inflow from operating activities
    'trading_acquisition_ias2', -- Outflow from operating activities
    'gas_fees', -- Outflow from operating activities
    'investment_acquisition_ias38', -- Outflow from investing activities
    'sale_ias38' -- Inflow from investing activities
)
GROUP BY user_id, usage
ORDER BY user_id, item;
