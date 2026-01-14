-- EMERGENCY FIX: Drop and Recreate ALL Views with corrected Type Casting
-- This ensures 'invalid input syntax' errors are resolved by comparing TEXT IDs.

-- 1. Drop dependent views first (Reverse Dependency Order)
DROP VIEW IF EXISTS public.v_cash_flow_statement;
DROP VIEW IF EXISTS public.v_balance_sheet;
DROP VIEW IF EXISTS public.v_profit_loss_statement;
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE; -- Cascade just in case

-- 2. Recreate all_transactions with CORRECTED JOIN LOGIC (Casting IDs to TEXT)
CREATE VIEW public.all_transactions AS
SELECT
    t.id,
    t.user_id,
    t.reference_id,
    t.date,
    t.source,
    t.chain,
    t.description,
    t.amount,
    t.asset,
    t.price,
    t.value_usd,
    t.value_jpy,
    t.value_eur,
    t.type,
    t.usage,
    t.note,
    CASE
        WHEN t.source = 'wallet' THEN wc.entity_id
        WHEN t.source = 'exchange' THEN xc.entity_id
        ELSE NULL
    END AS entity_id,
    CASE
        WHEN t.source = 'wallet' THEN e_w.name
        WHEN t.source = 'exchange' THEN e_e.name
        ELSE NULL
    END AS entity_name,
    t.quote_asset,
    t.wallet_address,
    t.connection_name,
    t.connection_id -- CRITICAL: Exposed for debugging/joins
FROM (
    -- Wallet Transactions
    SELECT
        wt.id::text AS reference_id,
        ('w_' || wt.id) AS id,
        wt.user_id,
        wt.timestamp AS date,
        'wallet'::text AS source,
        wc.chain,
        'Wallet Transaction'::text AS description,
        wt.amount,
        wt.asset AS asset,
        CASE WHEN wt.amount IS NULL OR wt.amount = 0 THEN 0 ELSE wt.value_in_usd / wt.amount END AS price,
        wt.value_in_usd AS value_usd,
        NULL::numeric AS value_jpy,
        NULL::numeric AS value_eur,
        wt.usage,
        wt.note,
        wt.type,
        wc.id::text AS connection_id,
        NULL::text AS quote_asset,
        wt.wallet_address,
        NULL::text AS connection_name
    FROM wallet_transactions wt
    JOIN wallet_connections wc ON wt.wallet_address = wc.wallet_address AND wt.user_id = wc.user_id

    UNION ALL

    -- Exchange Trades
    SELECT
        et.trade_id::text AS reference_id,
        ('e_' || et.trade_id) AS id,
        et.user_id,
        et.ts AS date,
        'exchange'::text AS source,
        ec.exchange AS chain,
        'Exchange Trade'::text AS description,
        CASE 
            WHEN et.side = 'sell' THEN et.fee_currency::numeric
            ELSE et.amount 
        END AS amount,
        et.symbol AS asset,
        et.price,
        et.value_usd, 
        NULL::numeric AS value_jpy,
        NULL::numeric AS value_eur,
        et.usage,
        et.note,
        et.side AS type,
        ec.id::text AS connection_id,
        NULL::text AS quote_asset,
        NULL::text AS wallet_address,
        ec.connection_name
    FROM exchange_trades et
    JOIN exchange_connections ec ON et.exchange_connection_id = ec.id
) t
-- CRITICAL FIX: Cast table IDs to TEXT matches t.connection_id type
LEFT JOIN wallet_connections wc ON t.source = 'wallet' AND t.connection_id = wc.id::text
LEFT JOIN exchange_connections xc ON t.source = 'exchange' AND t.connection_id = xc.id::text
LEFT JOIN entities e_w ON wc.entity_id = e_w.id
LEFT JOIN entities e_e ON xc.entity_id = e_e.id;

-- 3. Recreate internal_transfer_pairs
CREATE VIEW public.internal_transfer_pairs AS
SELECT
    tx_out.user_id,
    tx_out.id AS withdrawal_id,
    tx_in.id AS deposit_id
FROM
    public.all_transactions tx_out
JOIN
    public.all_transactions tx_in
    ON tx_out.user_id = tx_in.user_id
    AND tx_out.asset = tx_in.asset
    AND (tx_out.type ILIKE 'withdraw%' OR tx_out.type = 'send')
    AND (tx_in.type ILIKE 'deposit%' OR tx_in.type = 'receive')
    AND tx_in.amount BETWEEN (tx_out.amount * 0.999) AND tx_out.amount
    AND tx_in.date > tx_out.date
    AND tx_in.date <= (tx_out.date + INTERVAL '12 hours')
    AND COALESCE(tx_out.connection_name, tx_out.wallet_address) <> COALESCE(tx_in.connection_name, tx_in.wallet_address);

-- 4. Recreate v_all_transactions_classified
CREATE VIEW public.v_all_transactions_classified AS
WITH all_internal_ids AS (
    SELECT withdrawal_id AS id FROM public.internal_transfer_pairs
    UNION
    SELECT deposit_id AS id FROM public.internal_transfer_pairs
)
SELECT
    t.*,
    CASE
        WHEN ai.id IS NOT NULL THEN 'INTERNAL_TRANSFER'
        WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
        WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' THEN 'DEPOSIT'
        WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' THEN 'WITHDRAWAL'
        ELSE 'OTHER'
    END as transaction_type
FROM
    public.all_transactions t
LEFT JOIN
    all_internal_ids ai ON t.id = ai.id;

-- 5. Recreate v_holdings
CREATE VIEW public.v_holdings AS
WITH latest_rates AS (
    SELECT DISTINCT ON (target_currency)
        target_currency,
        rate
    FROM public.daily_exchange_rates
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
current_quantities AS (
    SELECT
        user_id,
        entity_id,
        asset,
        sum(
            CASE
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
        entity_id,
        asset
)
SELECT 
    cq.user_id,
    cq.entity_id,
    cq.asset,
    cq.current_amount,
    ap.current_price AS current_price,
    (cq.current_amount * ap.current_price) AS current_value_usd,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'JPY'), 1)) AS current_value_jpy,
    (cq.current_amount * ap.current_price * COALESCE((SELECT rate FROM latest_rates WHERE target_currency = 'EUR'), 1)) AS current_value_eur,
    now() AS last_updated
FROM current_quantities cq
LEFT JOIN public.asset_prices ap ON TRIM(UPPER(cq.asset)) = TRIM(UPPER(ap.asset))
WHERE cq.current_amount > 1e-9;

-- 6. Recreate Reports
CREATE VIEW public.v_profit_loss_statement AS
SELECT
    user_id,
    entity_id,
    date,
    CASE
        WHEN usage = 'sales_revenue' THEN 'Sales Revenue (IAS 2)'
        WHEN usage = 'other_revenue' THEN 'Consideration Revenue (IFRS 15)'
        WHEN usage = 'cost_of_sales' THEN 'Cost of Goods Sold (IAS 2)'
        WHEN usage = 'staking' THEN 'Staking & Mining Rewards'
        WHEN usage = 'mining' THEN 'Staking & Mining Rewards'
        WHEN usage = 'gas_fee' THEN 'Gas & Network Fees'
        WHEN usage = 'lost' THEN 'Loss of Crypto (Unrecoverable)'
        ELSE usage
    END AS account,
    value_usd AS amount_usd,
    value_jpy AS amount_jpy,
    value_eur AS amount_eur,
    
    value_usd AS balance, 
    value_usd AS balance_usd,
    value_jpy AS balance_jpy,
    value_eur AS balance_eur
FROM all_transactions
WHERE usage IS NOT NULL AND type != 'transfer';

CREATE VIEW public.v_balance_sheet AS
SELECT
    user_id,
    entity_id,
    timezone('utc', now()) AS date,
    'Inventory (Trading Crypto)' AS account,
    current_value_usd AS balance,
    current_value_usd AS balance_usd,
    current_value_jpy AS balance_jpy,
    current_value_eur AS balance_eur
FROM v_holdings;

CREATE VIEW public.v_cash_flow_statement AS
SELECT
    user_id,
    entity_id,
    date,
    CASE
        WHEN usage = 'sales_revenue' THEN 'Inflow from Sales (IAS 2 & IFRS 15)'
        WHEN usage = 'cost_of_sales' THEN 'Outflow for Inventory (IAS 2)'
        WHEN usage = 'gas_fee' THEN 'Outflow for Gas Fees'
        ELSE usage
    END AS item,
    value_usd AS amount,
    value_usd AS amount_usd,
    value_jpy AS amount_jpy,
    value_eur AS amount_eur
FROM all_transactions
WHERE usage IS NOT NULL;
