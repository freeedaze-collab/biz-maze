-- Migration: Update insert_wallet_transactions RPC to match the new unique index
-- This ensures that the RPC correctly handles conflicts based on log_index

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
            -- Match the unique index: (tx_hash, user_id, chain, COALESCE(log_index, -1))
            ON CONFLICT (tx_hash, user_id, chain, COALESCE(log_index, -1)) DO NOTHING;
            
            IF FOUND THEN
                v_count := v_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Skip individual failures
            RAISE WARNING 'Failed to insert tx %: %', v_tx->>'tx_hash', SQLERRM;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$;
