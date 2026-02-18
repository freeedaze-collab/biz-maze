-- SAFE FEE TRACKING MIGRATION - Based on EXACT Production Schema
-- Source: 20260116173803_supabase/migrations/20260117023500_sync_prod_schema.sql.sql
-- Strategy: CREATE OR REPLACE only (NO DROP), add columns at end only

CREATE OR REPLACE VIEW public.all_transactions AS
WITH 
latest_fiat_rates AS (
    SELECT DISTINCT ON (target_currency)
        target_currency,
        rate
    FROM public.daily_exchange_rates
    WHERE source_currency = 'USD'
      AND target_currency = ANY(ARRAY['JPY', 'EUR', 'GBP', 'INR', 'SGD'])
    ORDER BY target_currency, date DESC
),
jpy_to_usd AS (
    SELECT COALESCE(1.0 / NULLIF(rate, 0), 0.0066) AS rate
    FROM public.daily_exchange_rates
    WHERE source_currency = 'USD' AND target_currency = 'JPY'
    ORDER BY date DESC
    LIMIT 1
),
base_transactions AS (
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
        t.raw_value_usd,
        t.usage,
        t.note,
        t.type,
        t.connection_id,
        t.quote_asset,
        t.wallet_address,
        t.connection_name,
        -- NEW: Fee tracking columns (minimal addition)
        t.fee,
        t.fee_asset,
        t.id AS parent_id,
        t.type AS parent_type,
        'main'::text AS row_type
    FROM (
        -- Wallet Transactions (EXACT production copy + fee columns)
        SELECT
            wt.id::text AS reference_id,
            ('w_' || wt.id) AS id,
            wt.user_id,
            wt.timestamp AS date,
            'wallet'::text AS source,
            wc_1.chain,
            'Wallet Transaction'::text AS description,
            wt.amount,
            wt.asset,
            CASE
                WHEN wt.amount IS NULL OR wt.amount = 0 THEN 0
                WHEN wt.value_in_usd IS NOT NULL AND wt.value_in_usd > 0 THEN wt.value_in_usd / wt.amount
                ELSE COALESCE((SELECT ap.current_price FROM public.asset_prices ap WHERE upper(ap.asset) = upper(wt.asset)), 0)
            END AS price,
            COALESCE(
                NULLIF(wt.value_in_usd, 0),
                wt.amount * (SELECT ap.current_price FROM public.asset_prices ap WHERE upper(ap.asset) = upper(wt.asset))
            ) AS raw_value_usd,
            wt.usage,
            wt.note,
            wt.type,
            wc_1.id::text AS connection_id,
            NULL::text AS quote_asset,
            wt.wallet_address,
            NULL::text AS connection_name,
            -- NEW: Fee columns
            wt.fee,
            wt.fee_currency AS fee_asset
        FROM public.wallet_transactions wt
        JOIN public.wallet_connections wc_1 ON wt.wallet_address = wc_1.wallet_address AND wt.user_id = wc_1.user_id

        UNION ALL

        -- Exchange Trades (EXACT production copy + fee columns)
        SELECT
            et.trade_id AS reference_id,
            ('e_' || et.trade_id) AS id,
            et.user_id,
            et.ts AS date,
            'exchange'::text AS source,
            ec.exchange AS chain,
            'Exchange Trade'::text AS description,
            -- PRESERVE EXACT JPY pair amount logic
            CASE
                WHEN et.side = 'sell' THEN
                    CASE
                        WHEN et.fee_currency ~ '^[0-9]+\.?[0-9]*$' THEN et.fee_currency::numeric
                        ELSE et.amount
                    END
                ELSE et.amount
            END AS amount,
            -- PRESERVE EXACT asset extraction logic
            CASE
                WHEN et.symbol ~~ '%/%' THEN split_part(et.symbol, '/', 1)
                ELSE et.symbol
            END AS asset,
            et.price,
            -- PRESERVE EXACT JPY pair value_usd calculation
            CASE
                WHEN et.symbol ~~ '%/JPY' THEN
                    CASE
                        WHEN et.side = 'sell' THEN et.amount * (SELECT rate FROM jpy_to_usd)
                        WHEN et.side = 'buy' THEN
                            CASE
                                WHEN et.fee_currency ~ '^[0-9]+\.?[0-9]*$' THEN et.fee_currency::numeric * (SELECT rate FROM jpy_to_usd)
                                ELSE NULL
                            END
                        ELSE et.value_usd
                    END
                WHEN et.side ~~* 'withdraw%' THEN
                    et.amount * COALESCE(
                        (SELECT ap.current_price FROM public.asset_prices ap
                         WHERE upper(ap.asset) = upper(
                            CASE WHEN et.symbol ~~ '%/%' THEN split_part(et.symbol, '/', 1)
                            ELSE et.symbol END
                         )),
                        0
                    )
                ELSE COALESCE(et.value_usd, et.price * et.amount)
            END AS raw_value_usd,
            et.usage,
            et.note,
            et.side AS type,
            ec.id::text AS connection_id,
            -- PRESERVE EXACT quote_asset extraction
            CASE
                WHEN et.symbol ~~ '%/%' THEN split_part(et.symbol, '/', 2)
                ELSE NULL
            END AS quote_asset,
            NULL::text AS wallet_address,
            ec.connection_name,
            -- NEW: Fee columns
            et.fee,
            et.fee_currency AS fee_asset
        FROM public.exchange_trades et
        JOIN public.exchange_connections ec ON et.exchange_connection_id = ec.id
    ) t
),
-- NEW: Fee transactions CTE
fee_transactions AS (
    SELECT
        (bt.id || '_fee') AS id,
        bt.user_id,
        bt.reference_id,
        bt.date,
        bt.source,
        bt.chain,
        'Transaction Fee'::text AS description,
        bt.fee AS amount,
        bt.fee_asset AS asset,
        COALESCE(
            (SELECT ap.current_price FROM public.asset_prices ap WHERE upper(ap.asset) = upper(bt.fee_asset)),
            0
        ) AS price,
        bt.fee * COALESCE(
            (SELECT ap.current_price FROM public.asset_prices ap WHERE upper(ap.asset) = upper(bt.fee_asset)),
            0
        ) AS raw_value_usd,
        CASE
            WHEN bt.parent_type IN ('buy', 'deposit') THEN 'acquisition_cost'
            WHEN bt.parent_type = 'sell' THEN 'trading_fee'
            WHEN bt.parent_type IN ('send', 'withdraw') AND bt.fee_asset NOT IN ('USD', 'USDT', 'USDC', 'JPY') THEN 'gas_fee_noncash'
            WHEN bt.parent_type IN ('staking_reward', 'interest', 'reward') THEN 'staking_fee'
            WHEN bt.fee_asset IN ('USD', 'USDT', 'USDC', 'JPY', 'EUR') THEN 'custody_fee'
            ELSE 'other_fee'
        END AS usage,
        'Fee for ' || bt.parent_type AS note,
        'fee'::text AS type,
        bt.connection_id,
        NULL::text AS quote_asset,
        bt.wallet_address,
        bt.connection_name,
        NULL::numeric AS fee,
        NULL::text AS fee_asset,
        bt.parent_id,
        bt.parent_type,
        'fee'::text AS row_type
    FROM base_transactions bt
    WHERE bt.fee IS NOT NULL 
      AND bt.fee > 0 
      AND bt.fee_asset IS NOT NULL
      AND bt.row_type = 'main'
),
-- NEW: Combine all transactions
all_txs AS (
    SELECT * FROM base_transactions
    UNION ALL
    SELECT * FROM fee_transactions
)
-- Final SELECT (EXACT production column order + new columns at end)
SELECT
    bt.id,
    bt.user_id,
    bt.reference_id,
    bt.date,
    bt.source,
    bt.chain,
    bt.description,
    bt.amount,
    bt.asset,
    bt.price,
    bt.raw_value_usd AS value_usd,
    bt.raw_value_usd * COALESCE((SELECT rate FROM latest_fiat_rates WHERE target_currency = 'JPY'), 152) AS value_jpy,
    bt.raw_value_usd * COALESCE((SELECT rate FROM latest_fiat_rates WHERE target_currency = 'EUR'), 0.94) AS value_eur,
    bt.type,
    bt.usage,
    bt.note,
    CASE
        WHEN bt.source = 'wallet' THEN wc.entity_id
        WHEN bt.source = 'exchange' THEN xc.entity_id
        ELSE NULL::uuid
    END AS entity_id,
    CASE
        WHEN bt.source = 'wallet' THEN e_w.name
        WHEN bt.source = 'exchange' THEN e_e.name
        ELSE NULL::text
    END AS entity_name,
    bt.quote_asset,
    bt.wallet_address,
    bt.connection_name,
    bt.connection_id,
    -- NEW: Fee tracking columns (added at end, no impact on existing queries)
    bt.parent_id,
    bt.parent_type,
    bt.row_type
FROM all_txs bt
LEFT JOIN public.wallet_connections wc ON bt.source = 'wallet' AND bt.connection_id = wc.id::text
LEFT JOIN public.exchange_connections xc ON bt.source = 'exchange' AND bt.connection_id = xc.id::text
LEFT JOIN public.entities e_w ON wc.entity_id = e_w.id
LEFT JOIN public.entities e_e ON xc.entity_id = e_e.id;

COMMENT ON VIEW public.all_transactions IS 'Unified transactions view with fee tracking. Fee transactions have row_type=''fee'' and auto-classified usage. Preserves all production logic for JPY pairs and multi-currency calculations.';
