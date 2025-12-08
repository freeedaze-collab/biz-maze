
CREATE TABLE IF NOT EXISTS "public"."daily_exchange_rates" (
    "date" date NOT NULL,
    "source_currency" text NOT NULL,
    "target_currency" text NOT NULL,
    "rate" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("date", "source_currency", "target_currency")
);

COMMENT ON TABLE "public"."daily_exchange_rates" IS 'Stores daily historical exchange rates for converting transaction values into a common currency like USD.';
COMMENT ON COLUMN "public"."daily_exchange_rates"."date" IS 'The specific date for which the exchange rate is valid.';
COMMENT ON COLUMN "public"."daily_exchange_rates"."source_currency" IS 'The original currency of the transaction (e.g., JPY, EUR).';
COMMENT ON COLUMN "public"."daily_exchange_rates"."target_currency" IS 'The target currency for conversion (e.g., USD).';
COMMENT ON COLUMN "public"."daily_exchange_rates"."rate" IS 'The market rate for converting one unit of the source currency into the target currency.';

