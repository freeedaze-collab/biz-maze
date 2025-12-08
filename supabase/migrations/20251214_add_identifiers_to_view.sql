-- supabase/migrations/20251214_add_identifiers_to_view.sql
-- PURPOSE: Add wallet_address and exchange_connection_id to the all_transactions view for internal transfer detection.

-- Drop the view and any views that depend on it.
DROP VIEW IF EXISTS public.all_transactions CASCADE;

CREATE OR REPLACE VIEW public.all_transactions AS

-- =================================================================
-- On-chain Transactions (FROM: public.wallet_transactions)
-- =================================================================
SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset,
    NULL AS quote_asset,
    NULL AS price,
    t.direction AS type,
    'on-chain' as source,
    t.chain_id::text AS chain,
    -- ★ ADDED: Identifier columns for internal transfer matching
    t.wallet_address,          -- The wallet address involved
    NULL::bigint AS exchange_connection_id -- No exchange connection for on-chain tx

FROM
    public.wallet_transactions t

UNION ALL

-- =================================================================
-- Exchange Trades (FROM: public.exchange_trades)
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' ||
      (CASE
          WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
          ELSE 0
      END)::text AS description,
    et.amount,
    split_part(et.symbol, '/', 1) AS asset,
    split_part(et.symbol, '/', 2) AS quote_asset,
    CASE
      WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
      ELSE 0
    END AS price,
    et.side AS type,
    'exchange' as source,
    et.exchange AS chain,
    -- ★ ADDED: Identifier columns for internal transfer matching
    NULL::text AS wallet_address,      -- No wallet address for exchange tx
    et.exchange_connection_id      -- The exchange connection id involved
FROM
    public.exchange_trades et;
