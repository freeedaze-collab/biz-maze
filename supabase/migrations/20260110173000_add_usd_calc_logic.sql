-- 1. Create Function to calculate USD value based on daily rates
CREATE OR REPLACE FUNCTION public.calculate_wallet_tx_usd_value()
RETURNS TRIGGER AS $$
DECLARE
    found_rate NUMERIC;
BEGIN
    -- Only calculate if amount and asset_symbol are present
    IF NEW.amount IS NOT NULL AND NEW.asset_symbol IS NOT NULL AND NEW.occurred_at IS NOT NULL THEN
        
        -- Try to find exact match for date
        SELECT rate INTO found_rate
        FROM public.daily_exchange_rates
        WHERE date = NEW.occurred_at::date
          AND source_currency = NEW.asset_symbol
          AND target_currency = 'USD';
        
        -- If found, apply it
        IF found_rate IS NOT NULL THEN
            NEW.fiat_value_usd := NEW.amount * found_rate;
            NEW.value_in_usd := NEW.amount * found_rate; -- Keep alias in sync
        END IF;

        -- If rate not found, leave as is (or could default to 0, but NULL is safer for "unknown")
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS trigger_calculate_wallet_tx_usd ON public.wallet_transactions;

CREATE TRIGGER trigger_calculate_wallet_tx_usd
BEFORE INSERT OR UPDATE ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_wallet_tx_usd_value();

-- 3. Seed Data (as requested for 11/26 and 12/7)
-- Assuming 2025 based on current system time (Jan 2026).
INSERT INTO public.daily_exchange_rates (date, source_currency, target_currency, rate)
VALUES 
    -- 2025-11-26
    ('2025-11-26', 'ETH', 'USD', 3500.00),
    ('2025-11-26', 'BTC', 'USD', 95000.00),
    ('2025-11-26', 'MATIC', 'USD', 1.20),
    ('2025-11-26', 'USDC', 'USD', 1.00),
    ('2025-11-26', 'USDT', 'USD', 1.00),
    ('2025-11-26', 'AVAX', 'USD', 45.00),
    ('2025-11-26', 'BNB', 'USD', 650.00),
    
    -- 2025-12-07
    ('2025-12-07', 'ETH', 'USD', 3600.00),
    ('2025-12-07', 'BTC', 'USD', 98000.00),
    ('2025-12-07', 'MATIC', 'USD', 1.25),
    ('2025-12-07', 'USDC', 'USD', 1.00),
    ('2025-12-07', 'USDT', 'USD', 1.00),
    ('2025-12-07', 'AVAX', 'USD', 48.00),
    ('2025-12-07', 'BNB', 'USD', 660.00)
ON CONFLICT (date, source_currency, target_currency) 
DO UPDATE SET rate = EXCLUDED.rate;

-- 4. Backfill existing rows
UPDATE public.wallet_transactions
SET updated_at = now() -- Determines that row is "updated" and fires trigger? 
-- No, direct UPDATE will fire trigger. But we need to make sure the trigger logic runs.
WHERE fiat_value_usd IS NULL OR fiat_value_usd = 0;
