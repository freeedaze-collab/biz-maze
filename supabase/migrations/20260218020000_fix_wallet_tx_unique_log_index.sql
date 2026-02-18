-- Fix: unique constraint を (tx_hash, user_id, chain, log_index) に変更
-- 同一 tx_hash に複数の ERC20 transfer がある場合（Uniswap swap など）、
-- log_index で区別することで全ての transfer を保存できるようにする

-- Drop old constraint (both possible names)
ALTER TABLE public.wallet_transactions
    DROP CONSTRAINT IF EXISTS wallet_transactions_unique_tx;

-- Drop old index if it exists
DROP INDEX IF EXISTS public.wallet_transactions_unique_tx_log;

-- Create new unique index using COALESCE to handle NULL log_index
-- Native ETH transfers have no log_index, so we use -1 as sentinel value
-- ERC20 transfers each have a unique log_index within the same tx
CREATE UNIQUE INDEX wallet_transactions_unique_tx_log
    ON public.wallet_transactions (tx_hash, user_id, chain, COALESCE(log_index, -1));
