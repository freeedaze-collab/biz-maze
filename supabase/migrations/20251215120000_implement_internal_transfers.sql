-- supabase/migrations/20251215_implement_internal_transfers.sql
-- PURPOSE: Redefine views to accurately identify and classify internal transfers.

-- First, drop the dependent views. They will be recreated below.
-- This ensures that changes in the underlying all_transactions view are correctly propagated.
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;

-- =================================================================
-- VIEW 1: internal_transfer_pairs
-- PURPOSE: Identifies pairs of transactions that represent an internal transfer
-- between a user's own accounts (e.g., exchange-to-wallet).
-- =================================================================
CREATE OR REPLACE VIEW public.internal_transfer_pairs AS
SELECT
    tx_out.user_id,
    tx_out.id AS withdrawal_id, -- The ID of the outgoing transaction
    tx_in.id AS deposit_id     -- The ID of the incoming transaction
FROM
    public.all_transactions tx_out
JOIN
    public.all_transactions tx_in
    ON tx_out.user_id = tx_in.user_id                                     -- Must be the same user
    AND tx_out.asset = tx_in.asset                                         -- Must be the same crypto asset
    -- ★ FIXED: Match keywords using the unified 'type' column, removing reference to non-existent 'side' column.
    AND (tx_out.type ILIKE 'withdraw%' OR tx_out.type = 'send')
    AND (tx_in.type ILIKE 'deposit%' OR tx_in.type = 'receive')
    -- Amount must be very close (e.g., between 99.9% and 100% of sent amount to allow for fees)
    AND tx_in.amount BETWEEN (tx_out.amount * 0.999) AND tx_out.amount
    -- Deposit must happen *after* withdrawal, but within a 12-hour window
    AND tx_in.date > tx_out.date
    AND tx_in.date <= (tx_out.date + INTERVAL '12 hours')
    -- ★ CRUCIAL: The source and destination must be different accounts.
    -- This relies on the connection_name and wallet_address columns from our previous step.
    AND COALESCE(tx_out.connection_name, tx_out.wallet_address) <> COALESCE(tx_in.connection_name, tx_in.wallet_address);


-- =================================================================
-- VIEW 2: v_all_transactions_classified
-- PURPOSE: Classifies all transactions, giving priority to internal transfers.
-- This view will be used by v_holdings for final calculations.
-- =================================================================
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
WITH all_internal_ids AS (
    -- Create a single, distinct list of all transaction IDs that are part of an internal transfer
    SELECT withdrawal_id AS id FROM public.internal_transfer_pairs
    UNION
    SELECT deposit_id AS id FROM public.internal_transfer_pairs
)
SELECT
    t.*, -- Select all columns from the base view 'all_transactions'
    -- Classify the transaction type, prioritizing internal transfers
    CASE
        WHEN ai.id IS NOT NULL THEN 'INTERNAL_TRANSFER'
        WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
        -- ★ FIXED: Simplified the classification to match the corrected logic above.
        WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' THEN 'DEPOSIT'
        WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' THEN 'WITHDRAWAL'
        ELSE 'OTHER'
    END as transaction_type
FROM
    public.all_transactions t
LEFT JOIN
    all_internal_ids ai ON t.id = ai.id;
