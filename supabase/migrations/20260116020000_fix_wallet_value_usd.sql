-- Fix value_usd calculation for wallet transactions
-- Problem: sync-wallet-transactions saves value_in_usd as NULL
-- Solution: Fallback to asset_prices table for USD value calculation

CREATE OR REPLACE VIEW public.all_transactions AS
WITH 
latest_fiat_rates AS (
    SELECT DISTINCT ON (target_currency)
        target_currency,
        rate
    FROM public.daily_exchange_rates
    WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP', 'INR', 'SGD')
    ORDER BY target_currency, date DESC
),
jpy_to_usd AS (
    SELECT COALESCE(1.0 / NULLIF(rate, 0), 0.0066) as rate
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
        t.connection_name
    FROM (
        -- Wallet Transactions (FIXED: fallback to asset_prices if value_in_usd is null/0)
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
            CASE WHEN wt.amount IS NULL OR wt.amount = 0 THEN 0 
                 WHEN wt.value_in_usd IS NOT NULL AND wt.value_in_usd > 0 THEN wt.value_in_usd / wt.amount 
                 ELSE COALESCE(
                     (SELECT current_price FROM public.asset_prices ap WHERE UPPER(ap.asset) = UPPER(wt.asset)),
                     0
                 )
            END AS price,
            -- FIXED: Calculate value_usd from asset_prices if not available
            COALESCE(
                NULLIF(wt.value_in_usd, 0),
                wt.amount * (SELECT current_price FROM public.asset_prices ap WHERE UPPER(ap.asset) = UPPER(wt.asset))
            ) AS raw_value_usd,
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

        -- Exchange Trades (FIXED BUY/SELL LOGIC - unchanged)
        SELECT
            et.trade_id::text AS reference_id,
            ('e_' || et.trade_id) AS id,
            et.user_id,
            et.ts AS date,
            'exchange'::text AS source,
            ec.exchange AS chain,
            'Exchange Trade'::text AS description,
            
            CASE 
                WHEN et.side = 'sell' THEN 
                    CASE 
                        WHEN et.fee_currency ~ '^[0-9]+\.?[0-9]*$' THEN et.fee_currency::numeric
                        ELSE et.amount
                    END
                ELSE et.amount
            END AS amount,
            
            CASE 
                WHEN et.symbol LIKE '%/%' THEN split_part(et.symbol, '/', 1)
                ELSE et.symbol
            END AS asset,
            
            et.price,
            
            CASE
                WHEN et.symbol LIKE '%/JPY' THEN
                    CASE
                        WHEN et.side = 'sell' THEN 
                            et.amount * (SELECT rate FROM jpy_to_usd)
                        WHEN et.side = 'buy' THEN 
                            CASE 
                                WHEN et.fee_currency ~ '^[0-9]+\.?[0-9]*$' THEN et.fee_currency::numeric * (SELECT rate FROM jpy_to_usd)
                                ELSE NULL 
                            END
                        ELSE et.value_usd
                    END
                WHEN et.side ILIKE 'withdraw%' THEN
                    et.amount * COALESCE(
                        (SELECT current_price FROM public.asset_prices ap 
                         WHERE UPPER(ap.asset) = UPPER(CASE WHEN et.symbol LIKE '%/%' THEN split_part(et.symbol, '/', 1) ELSE et.symbol END)),
                        0)
                ELSE COALESCE(et.value_usd, et.price * et.amount)
            END AS raw_value_usd,
            
            et.usage,
            et.note,
            et.side AS type,
            ec.id::text AS connection_id,
            CASE WHEN et.symbol LIKE '%/%' THEN split_part(et.symbol, '/', 2) ELSE NULL END AS quote_asset,
            NULL::text AS wallet_address,
            ec.connection_name
        FROM exchange_trades et
        JOIN exchange_connections ec ON et.exchange_connection_id = ec.id
    ) t
)
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
        ELSE NULL
    END AS entity_id,
    CASE
        WHEN bt.source = 'wallet' THEN e_w.name
        WHEN bt.source = 'exchange' THEN e_e.name
        ELSE NULL
    END AS entity_name,
    bt.quote_asset,
    bt.wallet_address,
    bt.connection_name,
    bt.connection_id
FROM base_transactions bt
LEFT JOIN wallet_connections wc ON bt.source = 'wallet' AND bt.connection_id = wc.id::text
LEFT JOIN exchange_connections xc ON bt.source = 'exchange' AND bt.connection_id = xc.id::text
LEFT JOIN entities e_w ON wc.entity_id = e_w.id
LEFT JOIN entities e_e ON xc.entity_id = e_e.id;
