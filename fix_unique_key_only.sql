-- Apply only the wallet_transactions unique key fix
-- Run this after other migrations have been applied

\connect postgres

SET search_path TO public;

-- Drop the old unique index
DROP INDEX IF EXISTS public.wallet_tx_user_hash_uidx;

-- Create new unique index with asset and direction
-- This allows same tx_hash with different assets or directions
CREATE UNIQUE INDEX wallet_tx_user_hash_asset_dir_uidx 
ON public.wallet_transactions 
USING btree (user_id, tx_hash, asset, direction);

-- Add comment for documentation
COMMENT ON INDEX public.wallet_tx_user_hash_asset_dir_uidx IS 
'Unique constraint allowing multiple token movements per transaction hash (e.g., swap IN and OUT)';

-- Verify the index was created
\d wallet_transactions
