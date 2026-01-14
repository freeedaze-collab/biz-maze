-- Fix type casting issue in all_transactions view
-- Previous migration applied the view but with incorrect casting logic causing invalid input syntax errors.
-- This migration updates the view definition to cast table IDs to text for JOINs.

CREATE OR REPLACE VIEW public.all_transactions AS
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
    t.connection_name
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
        et.amount,
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
LEFT JOIN wallet_connections wc ON t.source = 'wallet' AND t.connection_id = wc.id::text
LEFT JOIN exchange_connections xc ON t.source = 'exchange' AND t.connection_id = xc.id::text
LEFT JOIN entities e_w ON wc.entity_id = e_w.id
LEFT JOIN entities e_e ON xc.entity_id = e_e.id;
