-- Idempotent unique index for upsert de-duplication
-- Key: (chain_id, tx_hash, log_index)
create unique index if not exists ux_transactions_chain_tx_log
  on public.transactions (chain_id, tx_hash, log_index);
