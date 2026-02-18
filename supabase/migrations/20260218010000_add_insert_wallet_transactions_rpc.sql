-- Create a DB function to bulk insert wallet transactions with ON CONFLICT DO NOTHING
-- This bypasses the Supabase PostgREST upsert constraint requirement

CREATE OR REPLACE FUNCTION public.insert_wallet_transactions(
    p_transactions JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
    v_tx JSONB;
BEGIN
    FOR v_tx IN SELECT * FROM jsonb_array_elements(p_transactions)
    LOOP
        BEGIN
            INSERT INTO public.wallet_transactions (
                user_id,
                wallet_address,
                tx_hash,
                chain,
                timestamp,
                amount,
                asset,
                asset_decimals,
                direction,
                type,
                from_address,
                to_address,
                description,
                source,
                metadata,
                log_index,
                token_address
            ) VALUES (
                (v_tx->>'user_id')::UUID,
                v_tx->>'wallet_address',
                v_tx->>'tx_hash',
                v_tx->>'chain',
                (v_tx->>'timestamp')::TIMESTAMPTZ,
                (v_tx->>'amount')::NUMERIC,
                v_tx->>'asset',
                (v_tx->>'asset_decimals')::INTEGER,
                v_tx->>'direction',
                v_tx->>'type',
                v_tx->>'from_address',
                v_tx->>'to_address',
                v_tx->>'description',
                v_tx->>'source',
                COALESCE((v_tx->>'metadata')::JSONB, '{}'::JSONB),
                (v_tx->>'log_index')::INTEGER,
                v_tx->>'token_address'
            )
            ON CONFLICT (tx_hash, user_id, chain) DO NOTHING;
            
            IF FOUND THEN
                v_count := v_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Skip individual failures (e.g., column type mismatch)
            RAISE WARNING 'Failed to insert tx %: %', v_tx->>'tx_hash', SQLERRM;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.insert_wallet_transactions(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_wallet_transactions(JSONB) TO authenticated;
