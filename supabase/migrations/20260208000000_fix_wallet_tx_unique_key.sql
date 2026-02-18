-- Fix wallet_transactions unique key to support multiple token movements per tx_hash
-- This allows recording both sides of swaps and multi-token transactions

-- Drop the old unique index
DROP INDEX IF EXISTS public.wallet_tx_user_hash_uidx;

-- DEDUPLICATION step: Remove precise duplicates that would violate the new index
-- (Keeps the record with the latest id to ensure consistency)
DELETE FROM public.wallet_transactions t1
USING public.wallet_transactions t2
WHERE t1.id < t2.id
  AND t1.user_id = t2.user_id
  AND t1.tx_hash = t2.tx_hash
  AND t1.asset = t2.asset
  AND t1.direction = t2.direction;

-- Create new unique index with asset and direction
-- This allows same tx_hash with different assets or directions
CREATE UNIQUE INDEX wallet_tx_user_hash_asset_dir_uidx 
ON public.wallet_transactions 
USING btree (user_id, tx_hash, asset, direction);

-- Add comment for documentation
COMMENT ON INDEX public.wallet_tx_user_hash_asset_dir_uidx IS 
'Unique constraint allowing multiple token movements per transaction hash (e.g., swap IN and OUT)';
