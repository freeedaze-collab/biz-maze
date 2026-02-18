-- Drop redundant unique indexes that prevent multiple transfers
-- within the same tx_hash from being saved.
--
-- The correct constraint is wallet_transactions_unique_tx_log:
--   (tx_hash, user_id, chain, COALESCE(log_index, -1))
-- This correctly allows multiple ERC20 transfers in the same tx
-- (they have different log_index values).
--
-- The following indexes are too broad and incorrectly block
-- legitimate duplicate asset/direction entries in the same tx:

-- Blocks same asset+direction in same tx (e.g. GTC OUT x14 multi-send)
DROP INDEX IF EXISTS public.wallet_tx_user_hash_asset_dir_uidx;

-- Also blocks same asset+direction+chain in same tx
DROP INDEX IF EXISTS public.wallet_transactions_composite_key;

-- Also blocks same asset+direction in same tx (with log_index but still too broad)
DROP INDEX IF EXISTS public.wallet_tx_user_hash_asset_dir_log_uidx;
