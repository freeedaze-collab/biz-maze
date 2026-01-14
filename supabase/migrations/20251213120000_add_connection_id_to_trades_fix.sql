-- Step 1 (fixed): Add exchange_connection_id to exchange_trades with the correct BIGINT type.

ALTER TABLE public.exchange_trades
ADD COLUMN IF NOT EXISTS exchange_connection_id BIGINT;

-- Add a foreign key constraint to link to the 'id' in the 'exchange_connections' table.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_exchange_connections') THEN
        ALTER TABLE public.exchange_trades
        ADD CONSTRAINT fk_exchange_connections
        FOREIGN KEY (exchange_connection_id)
        REFERENCES public.exchange_connections(id)
        ON DELETE SET NULL;
    END IF;
END $$;


-- Add an index for performance.
CREATE INDEX IF NOT EXISTS idx_exchange_trades_connection_id
ON public.exchange_trades(exchange_connection_id);
