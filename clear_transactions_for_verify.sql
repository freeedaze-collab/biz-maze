-- Clear all wallet transactions to start fresh for verification
DELETE FROM public.wallet_transactions;

-- Also reset sync state if applicable (since we want to fetch everything from page 1)
-- Check if wallet_sync_state exists first, if not ignore
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_sync_state') THEN
        DELETE FROM public.wallet_sync_state;
    END IF;
END $$;
