-- Migration: Create batch price update RPC
-- Description: Allows updating price_usd for multiple transactions by ID without providing other mandatory columns.

CREATE OR REPLACE FUNCTION update_wallet_transaction_prices(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.wallet_transactions AS t
    SET price_usd = (val->>'price')::numeric,
        updated_at = now()
    FROM jsonb_array_elements(updates) AS val
    WHERE t.id = (val->>'id')::bigint;
END;
$$;

-- Grant access to service_role and authenticated users
GRANT EXECUTE ON FUNCTION update_wallet_transaction_prices(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION update_wallet_transaction_prices(jsonb) TO authenticated;
