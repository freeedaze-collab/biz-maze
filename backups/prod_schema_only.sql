SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
COMMENT ON SCHEMA "public" IS 'standard public schema';
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE TYPE "public"."us_entity_type_enum" AS ENUM (
ALTER TYPE "public"."us_entity_type_enum" OWNER TO "postgres";
CREATE TYPE "public"."us_state_of_incorporation_enum" AS ENUM (
ALTER TYPE "public"."us_state_of_incorporation_enum" OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."calculate_wallet_tx_usd_value"() RETURNS "trigger"
    -- Only calculate if amount and asset_symbol are present
    IF NEW.amount IS NOT NULL AND NEW.asset_symbol IS NOT NULL AND NEW.occurred_at IS NOT NULL THEN
          AND source_currency = NEW.asset_symbol
ALTER FUNCTION "public"."calculate_wallet_tx_usd_value"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."clear_unused_profile_fields"() RETURNS "trigger"
ALTER FUNCTION "public"."clear_unused_profile_fields"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."decrypt_secret"("enc_input" "bytea", "key_input" "text") RETURNS "text"
ALTER FUNCTION "public"."decrypt_secret"("enc_input" "bytea", "key_input" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."encrypt_secret"("plain_input" "text", "key_input" "text") RETURNS "bytea"
ALTER FUNCTION "public"."encrypt_secret"("plain_input" "text", "key_input" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."fn_profiles_mirror_id_user_id"() RETURNS "trigger"
ALTER FUNCTION "public"."fn_profiles_mirror_id_user_id"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."get_decrypted_connection"("p_user_id" "uuid", "p_exchange" "text") RETURNS TABLE("api_key" "text", "api_secret" "text")
    SET "search_path" TO 'decrypted', 'public'
ALTER FUNCTION "public"."get_decrypted_connection"("p_user_id" "uuid", "p_exchange" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    SET "search_path" TO 'public'
  -- from the newly created user in auth.users.
ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."profiles_align_ids"() RETURNS "trigger"
ALTER FUNCTION "public"."profiles_align_ids"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."tg_invoices_set_updated_at"() RETURNS "trigger"
ALTER FUNCTION "public"."tg_invoices_set_updated_at"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    SET "search_path" TO 'public'
ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";
SET default_tablespace = '';
SET default_table_access_method = "heap";
CREATE TABLE IF NOT EXISTS "public"."asset_prices" (
    "asset" "text" NOT NULL,
ALTER TABLE "public"."asset_prices" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."daily_exchange_rates" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
ALTER TABLE "public"."daily_exchange_rates" OWNER TO "postgres";
COMMENT ON TABLE "public"."daily_exchange_rates" IS 'Stores daily historical exchange rates for converting transaction values into a common currency like USD.';
COMMENT ON COLUMN "public"."daily_exchange_rates"."date" IS 'The specific date for which the exchange rate is valid.';
COMMENT ON COLUMN "public"."daily_exchange_rates"."source_currency" IS 'The original currency of the transaction (e.g., JPY, EUR).';
COMMENT ON COLUMN "public"."daily_exchange_rates"."target_currency" IS 'The target currency for conversion (e.g., USD).';
COMMENT ON COLUMN "public"."daily_exchange_rates"."rate" IS 'The market rate for converting one unit of the source currency into the target currency.';
CREATE TABLE IF NOT EXISTS "public"."entities" (
    "created_at" timestamp with time zone DEFAULT "now"(),
ALTER TABLE "public"."entities" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."exchange_connections" (
    "created_at" timestamp with time zone DEFAULT "now"(),
ALTER TABLE "public"."exchange_connections" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."exchange_trades" (
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fee_asset" "text",
ALTER TABLE "public"."exchange_trades" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."wallet_connections" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
ALTER TABLE "public"."wallet_connections" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "asset_symbol" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asset_decimals" smallint DEFAULT 18,
    "asset" "text",
ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."all_transactions" AS
            "t"."asset",
            "t"."quote_asset",
                    "wt"."asset",
                               FROM "public"."asset_prices" "ap"
                              WHERE ("upper"("ap"."asset") = "upper"("wt"."asset"))), (0)::numeric)
                           FROM "public"."asset_prices" "ap"
                          WHERE ("upper"("ap"."asset") = "upper"("wt"."asset"))))) AS "raw_value_usd",
                    NULL::"text" AS "quote_asset",
                        END AS "asset",
                               FROM "public"."asset_prices" "ap"
                              WHERE ("upper"("ap"."asset") = "upper"(
                        END AS "quote_asset",
    "bt"."asset",
    "bt"."quote_asset",
ALTER VIEW "public"."all_transactions" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
ALTER TABLE "public"."audit_logs" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."clients" (
    "created_at" timestamp with time zone DEFAULT "now"(),
ALTER TABLE "public"."clients" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."companies" (
    "created_at" timestamp with time zone DEFAULT "now"(),
ALTER TABLE "public"."companies" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."crypto_payments" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
ALTER TABLE "public"."crypto_payments" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."customers" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
ALTER TABLE "public"."customers" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."exchange_accounts" (
ALTER TABLE "public"."exchange_accounts" OWNER TO "postgres";
ALTER TABLE "public"."exchange_accounts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
CREATE TABLE IF NOT EXISTS "public"."exchange_api_credentials" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
ALTER TABLE "public"."exchange_api_credentials" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."exchange_api_credentials_id_seq"
ALTER SEQUENCE "public"."exchange_api_credentials_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."exchange_api_credentials_id_seq" OWNED BY "public"."exchange_api_credentials"."id";
CREATE TABLE IF NOT EXISTS "public"."exchange_balances" (
    "asset" "text" NOT NULL,
ALTER TABLE "public"."exchange_balances" OWNER TO "postgres";
ALTER TABLE "public"."exchange_balances" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
ALTER TABLE "public"."exchange_connections" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
CREATE TABLE IF NOT EXISTS "public"."exchange_trade_values" (
    "asset" "text",
    "fee_asset" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
ALTER TABLE "public"."exchange_trade_values" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."exchange_transfers" (
    "asset" "text" NOT NULL,
ALTER TABLE "public"."exchange_transfers" OWNER TO "postgres";
ALTER TABLE "public"."exchange_transfers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
CREATE OR REPLACE VIEW "public"."wallet_tx_norm" AS
    COALESCE((NULLIF(("to_jsonb"("t".*) ->> 'occurred_at'::"text"), ''::"text"))::timestamp with time zone, (NULLIF(("to_jsonb"("t".*) ->> 'block_time'::"text"), ''::"text"))::timestamp with time zone, (NULLIF(("to_jsonb"("t".*) ->> 'timestamp'::"text"), ''::"text"))::timestamp with time zone, (NULLIF(("to_jsonb"("t".*) ->> 'created_at'::"text"), ''::"text"))::timestamp with time zone, "now"()) AS "occurred_at",
ALTER VIEW "public"."wallet_tx_norm" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."internal_transfer_candidates" AS
ALTER VIEW "public"."internal_transfer_candidates" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."internal_transfer_links" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
ALTER TABLE "public"."internal_transfer_links" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."internal_transfer_links_id_seq"
ALTER SEQUENCE "public"."internal_transfer_links_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."internal_transfer_links_id_seq" OWNED BY "public"."internal_transfer_links"."id";
CREATE OR REPLACE VIEW "public"."internal_transfer_pairs" AS
     JOIN "public"."all_transactions" "tx_in" ON ((("tx_out"."user_id" = "tx_in"."user_id") AND ("tx_out"."asset" = "tx_in"."asset") AND (("tx_out"."type" ~~* 'withdraw%'::"text") OR ("tx_out"."type" = 'send'::"text")) AND (("tx_in"."type" ~~* 'deposit%'::"text") OR ("tx_in"."type" = 'receive'::"text")) AND (("tx_in"."amount" >= ("tx_out"."amount" * 0.999)) AND ("tx_in"."amount" <= "tx_out"."amount")) AND ("tx_in"."date" > "tx_out"."date") AND ("tx_in"."date" <= ("tx_out"."date" + '12:00:00'::interval)) AND (COALESCE("tx_out"."connection_name", "tx_out"."wallet_address") <> COALESCE("tx_in"."connection_name", "tx_in"."wallet_address")))));
ALTER VIEW "public"."internal_transfer_pairs" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
ALTER TABLE "public"."invoices" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
ALTER TABLE "public"."journal_entries" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."journal_entries_id_seq"
ALTER SEQUENCE "public"."journal_entries_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."journal_entries_id_seq" OWNED BY "public"."journal_entries"."id";
CREATE TABLE IF NOT EXISTS "public"."journal_lines" (
    "created_at" timestamp with time zone DEFAULT "now"()
ALTER TABLE "public"."journal_lines" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."journal_lines_id_seq"
ALTER SEQUENCE "public"."journal_lines_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."journal_lines_id_seq" OWNED BY "public"."journal_lines"."id";
CREATE TABLE IF NOT EXISTS "public"."meter_events" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
ALTER TABLE "public"."meter_events" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."nonce_store" (
    "created_at" timestamp with time zone DEFAULT "now"()
ALTER TABLE "public"."nonce_store" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."payment_links" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
ALTER TABLE "public"."payment_links" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."payment_merchants" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
ALTER TABLE "public"."payment_merchants" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."payment_vault_addresses" (
    "asset" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
ALTER TABLE "public"."payment_vault_addresses" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."payment_vault_addresses_id_seq"
ALTER SEQUENCE "public"."payment_vault_addresses_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."payment_vault_addresses_id_seq" OWNED BY "public"."payment_vault_addresses"."id";
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
ALTER TABLE "public"."profiles" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."transaction_purposes" (
ALTER TABLE "public"."transaction_purposes" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."transaction_usage_labels" (
ALTER TABLE "public"."transaction_usage_labels" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."transaction_usage_labels_id_seq"
ALTER SEQUENCE "public"."transaction_usage_labels_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."transaction_usage_labels_id_seq" OWNED BY "public"."transaction_usage_labels"."id";
CREATE TABLE IF NOT EXISTS "public"."transaction_usage_predictions" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
ALTER TABLE "public"."transaction_usage_predictions" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."transaction_usages" (
    "created_at" timestamp with time zone DEFAULT "now"(),
ALTER TABLE "public"."transaction_usages" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asset_contract" "text",
    "asset_symbol" "text",
    "asset_decimals" integer,
ALTER TABLE "public"."transactions" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."transfer_links" (
    "created_at" timestamp with time zone DEFAULT "now"()
ALTER TABLE "public"."transfer_links" OWNER TO "postgres";
ALTER TABLE "public"."transfer_links" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
CREATE TABLE IF NOT EXISTS "public"."transfers" (
    "created_at" timestamp with time zone DEFAULT "now"()
ALTER TABLE "public"."transfers" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."usage_categories" (
ALTER TABLE "public"."usage_categories" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."user_monthly_counters" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
ALTER TABLE "public"."user_monthly_counters" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
ALTER TABLE "public"."user_sessions" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."v_all_transactions_classified" AS
    "t"."asset",
    "t"."quote_asset",
ALTER VIEW "public"."v_all_transactions_classified" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."v_holdings" AS
            "v_all_transactions_classified"."asset",
          GROUP BY "v_all_transactions_classified"."user_id", "v_all_transactions_classified"."entity_id", "v_all_transactions_classified"."entity_name", "v_all_transactions_classified"."asset"
    "cq"."asset",
     LEFT JOIN "public"."asset_prices" "ap" ON ((TRIM(BOTH FROM "upper"("cq"."asset")) = TRIM(BOTH FROM "upper"("ap"."asset")))))
ALTER VIEW "public"."v_holdings" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."v_balance_sheet" AS
    'Cryptocurrency Assets'::"text" AS "account",
ALTER VIEW "public"."v_balance_sheet" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."v_cash_flow_statement" AS
    'Acquisition of Crypto Assets'::"text" AS "item",
    'Proceeds from Sale of Crypto Assets'::"text" AS "item",
ALTER VIEW "public"."v_cash_flow_statement" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."v_profit_loss_statement" AS
ALTER VIEW "public"."v_profit_loss_statement" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."wallet_nonces" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
ALTER TABLE "public"."wallet_nonces" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."wallet_sync_state" (
ALTER TABLE "public"."wallet_sync_state" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."wallet_transaction" AS
    "asset_symbol",
    "created_at",
    "asset_decimals",
ALTER VIEW "public"."wallet_transaction" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."wallet_transactions_id_seq"
ALTER SEQUENCE "public"."wallet_transactions_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."wallet_transactions_id_seq" OWNED BY "public"."wallet_transactions"."id";
CREATE OR REPLACE VIEW "public"."wallet_tx_with_flags" AS
    "asset_symbol",
    "created_at",
    "asset_decimals",
ALTER VIEW "public"."wallet_tx_with_flags" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "created_at" timestamp with time zone DEFAULT "now"()
ALTER TABLE "public"."wallets" OWNER TO "postgres";
ALTER TABLE ONLY "public"."exchange_api_credentials" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exchange_api_credentials_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."internal_transfer_links" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."internal_transfer_links_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."journal_entries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."journal_entries_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."journal_lines" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."journal_lines_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."payment_vault_addresses" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."payment_vault_addresses_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."transaction_usage_labels" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transaction_usage_labels_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."wallet_transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wallet_transactions_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."asset_prices"
    ADD CONSTRAINT "asset_prices_pkey" PRIMARY KEY ("asset");
ALTER TABLE ONLY "public"."audit_logs"
ALTER TABLE ONLY "public"."clients"
ALTER TABLE ONLY "public"."companies"
ALTER TABLE ONLY "public"."crypto_payments"
ALTER TABLE ONLY "public"."customers"
ALTER TABLE ONLY "public"."daily_exchange_rates"
ALTER TABLE ONLY "public"."entities"
ALTER TABLE ONLY "public"."exchange_accounts"
ALTER TABLE ONLY "public"."exchange_accounts"
ALTER TABLE ONLY "public"."exchange_api_credentials"
ALTER TABLE ONLY "public"."exchange_api_credentials"
ALTER TABLE ONLY "public"."exchange_balances"
    ADD CONSTRAINT "exchange_balances_account_id_asset_at_key" UNIQUE ("account_id", "asset", "at");
ALTER TABLE ONLY "public"."exchange_balances"
ALTER TABLE ONLY "public"."exchange_connections"
ALTER TABLE ONLY "public"."exchange_trade_values"
ALTER TABLE ONLY "public"."exchange_trades"
ALTER TABLE ONLY "public"."exchange_trades"
ALTER TABLE ONLY "public"."exchange_trades"
ALTER TABLE ONLY "public"."exchange_trades"
ALTER TABLE ONLY "public"."exchange_transfers"
ALTER TABLE ONLY "public"."exchange_transfers"
ALTER TABLE ONLY "public"."internal_transfer_links"
ALTER TABLE ONLY "public"."internal_transfer_links"
ALTER TABLE ONLY "public"."invoices"
ALTER TABLE ONLY "public"."journal_entries"
ALTER TABLE ONLY "public"."journal_lines"
ALTER TABLE ONLY "public"."meter_events"
ALTER TABLE ONLY "public"."nonce_store"
ALTER TABLE ONLY "public"."payment_links"
ALTER TABLE ONLY "public"."payment_merchants"
ALTER TABLE ONLY "public"."payment_vault_addresses"
ALTER TABLE ONLY "public"."payment_vault_addresses"
    ADD CONSTRAINT "payment_vault_addresses_user_id_network_asset_key" UNIQUE ("user_id", "network", "asset");
ALTER TABLE ONLY "public"."profiles"
ALTER TABLE ONLY "public"."profiles"
ALTER TABLE ONLY "public"."transaction_purposes"
ALTER TABLE ONLY "public"."transaction_usage_labels"
ALTER TABLE ONLY "public"."transaction_usage_labels"
ALTER TABLE ONLY "public"."transaction_usage_labels"
ALTER TABLE ONLY "public"."transaction_usage_predictions"
ALTER TABLE ONLY "public"."transaction_usages"
ALTER TABLE ONLY "public"."transaction_usages"
ALTER TABLE ONLY "public"."transactions"
ALTER TABLE ONLY "public"."transactions"
ALTER TABLE ONLY "public"."transfer_links"
ALTER TABLE ONLY "public"."transfer_links"
ALTER TABLE ONLY "public"."transfers"
ALTER TABLE ONLY "public"."exchange_connections"
ALTER TABLE ONLY "public"."usage_categories"
ALTER TABLE ONLY "public"."user_monthly_counters"
ALTER TABLE ONLY "public"."user_monthly_counters"
ALTER TABLE ONLY "public"."user_sessions"
ALTER TABLE ONLY "public"."wallet_connections"
ALTER TABLE ONLY "public"."wallet_connections"
ALTER TABLE ONLY "public"."wallet_nonces"
ALTER TABLE ONLY "public"."wallet_sync_state"
ALTER TABLE ONLY "public"."wallet_transactions"
ALTER TABLE ONLY "public"."wallet_transactions"
ALTER TABLE ONLY "public"."wallets"
ALTER TABLE ONLY "public"."wallets"
CREATE INDEX "clients_user_idx" ON "public"."clients" USING "btree" ("user_id");
CREATE INDEX "companies_user_idx" ON "public"."companies" USING "btree" ("user_id");
CREATE INDEX "customers_user_id_idx" ON "public"."customers" USING "btree" ("user_id");
CREATE INDEX "exchange_api_credentials_exchange_idx" ON "public"."exchange_api_credentials" USING "btree" ("exchange");
CREATE INDEX "exchange_api_credentials_user_idx" ON "public"."exchange_api_credentials" USING "btree" ("user_id");
CREATE INDEX "exchange_connections_exchange_idx" ON "public"."exchange_connections" USING "btree" ("exchange");
CREATE INDEX "exchange_connections_user_id_idx" ON "public"."exchange_connections" USING "btree" ("user_id");
CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");
CREATE INDEX "idx_clients_user_id" ON "public"."clients" USING "btree" ("user_id");
CREATE INDEX "idx_companies_user_id" ON "public"."companies" USING "btree" ("user_id");
CREATE INDEX "idx_crypto_payments_user_id" ON "public"."crypto_payments" USING "btree" ("user_id");
CREATE INDEX "idx_customers_deleted_at" ON "public"."customers" USING "btree" ("deleted_at");
CREATE INDEX "idx_customers_user_id" ON "public"."customers" USING "btree" ("user_id");
CREATE INDEX "idx_entities_parent_id" ON "public"."entities" USING "btree" ("parent_id");
CREATE INDEX "idx_entities_user_id" ON "public"."entities" USING "btree" ("user_id");
CREATE INDEX "idx_exchange_connections_user_id" ON "public"."exchange_connections" USING "btree" ("user_id");
CREATE INDEX "idx_exchange_trades_connection_id" ON "public"."exchange_trades" USING "btree" ("exchange_connection_id");
CREATE INDEX "idx_invoices_user_id" ON "public"."invoices" USING "btree" ("user_id");
CREATE INDEX "idx_jlines_entry" ON "public"."journal_lines" USING "btree" ("entry_id");
CREATE INDEX "idx_meter_events_user_id" ON "public"."meter_events" USING "btree" ("user_id");
CREATE INDEX "idx_transaction_usage_labels_user_ctx" ON "public"."transaction_usage_labels" USING "btree" ("user_id", "ctx_id");
CREATE INDEX "idx_transaction_usage_labels_user_tx" ON "public"."transaction_usage_labels" USING "btree" ("user_id", "tx_id");
CREATE INDEX "idx_transactions_chain" ON "public"."transactions" USING "btree" ("chain_id");
CREATE INDEX "idx_transactions_hash" ON "public"."transactions" USING "btree" ("transaction_hash");
CREATE INDEX "idx_transactions_network" ON "public"."transactions" USING "btree" ("network");
CREATE UNIQUE INDEX "idx_transactions_unique" ON "public"."transactions" USING "btree" ("chain_id", "transaction_hash", "log_index");
CREATE INDEX "idx_transactions_user_id" ON "public"."transactions" USING "btree" ("user_id");
CREATE INDEX "idx_transactions_user_time" ON "public"."transactions" USING "btree" ("user_id", "transaction_date" DESC);
CREATE INDEX "idx_transactions_wallet_address" ON "public"."transactions" USING "btree" ("wallet_address");
CREATE INDEX "idx_transfers_client_id" ON "public"."transfers" USING "btree" ("client_id");
CREATE INDEX "idx_transfers_user_id" ON "public"."transfers" USING "btree" ("user_id");
CREATE INDEX "idx_tx_usage_user_ctx" ON "public"."transaction_usage_labels" USING "btree" ("user_id", "ctx_id");
CREATE INDEX "idx_tx_usage_user_tx" ON "public"."transaction_usage_labels" USING "btree" ("user_id", "tx_id");
CREATE INDEX "idx_user_sessions_user_id" ON "public"."user_sessions" USING "btree" ("user_id");
CREATE INDEX "idx_wallet_connections_address" ON "public"."wallet_connections" USING "btree" ("wallet_address");
CREATE INDEX "idx_wallet_connections_user_id" ON "public"."wallet_connections" USING "btree" ("user_id");
CREATE INDEX "idx_wallet_tx_user_ts" ON "public"."wallet_transactions" USING "btree" ("user_id", "timestamp" DESC);
CREATE INDEX "invoices_client_id_idx" ON "public"."invoices" USING "btree" ("client_id");
CREATE INDEX "invoices_company_id_idx" ON "public"."invoices" USING "btree" ("company_id");
CREATE INDEX "invoices_issue_date_idx" ON "public"."invoices" USING "btree" ("issue_date");
CREATE INDEX "invoices_user_id_idx" ON "public"."invoices" USING "btree" ("user_id");
CREATE INDEX "invoices_user_idx" ON "public"."invoices" USING "btree" ("user_id");
CREATE INDEX "itl_in_idx" ON "public"."internal_transfer_links" USING "btree" ("in_tx_id");
CREATE INDEX "itl_out_idx" ON "public"."internal_transfer_links" USING "btree" ("out_tx_id");
CREATE UNIQUE INDEX "payment_merchants_user_id_key" ON "public"."payment_merchants" USING "btree" ("user_id");
CREATE UNIQUE INDEX "transaction_usage_labels_user_ctx_key" ON "public"."transaction_usage_labels" USING "btree" ("user_id", "ctx_id") WHERE ("ctx_id" IS NOT NULL);
CREATE UNIQUE INDEX "transaction_usage_labels_user_tx_key" ON "public"."transaction_usage_labels" USING "btree" ("user_id", "tx_id") WHERE ("tx_id" IS NOT NULL);
CREATE UNIQUE INDEX "ux_profiles_user" ON "public"."profiles" USING "btree" ("user_id");
CREATE UNIQUE INDEX "wallet_tx_user_hash_uidx" ON "public"."wallet_transactions" USING "btree" ("user_id", "tx_hash");
CREATE UNIQUE INDEX "wallets_user_addr_uniq" ON "public"."wallets" USING "btree" ("user_id", "lower"("address"));
CREATE OR REPLACE TRIGGER "tr_invoices_set_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."tg_invoices_set_updated_at"();
CREATE OR REPLACE TRIGGER "update_crypto_payments_updated_at" BEFORE UPDATE ON "public"."crypto_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_transactions_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_user_monthly_counters_updated_at" BEFORE UPDATE ON "public"."user_monthly_counters" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_wallet_connections_updated_at" BEFORE UPDATE ON "public"."wallet_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
ALTER TABLE ONLY "public"."clients"
ALTER TABLE ONLY "public"."companies"
ALTER TABLE ONLY "public"."crypto_payments"
ALTER TABLE ONLY "public"."entities"
ALTER TABLE ONLY "public"."entities"
ALTER TABLE ONLY "public"."exchange_accounts"
ALTER TABLE ONLY "public"."exchange_api_credentials"
ALTER TABLE ONLY "public"."exchange_balances"
ALTER TABLE ONLY "public"."exchange_connections"
    ADD CONSTRAINT "exchange_connections_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."exchange_connections"
ALTER TABLE ONLY "public"."exchange_trades"
ALTER TABLE ONLY "public"."exchange_transfers"
ALTER TABLE ONLY "public"."exchange_trades"
    ADD CONSTRAINT "fk_exchange_connections" FOREIGN KEY ("exchange_connection_id") REFERENCES "public"."exchange_connections"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."journal_entries"
ALTER TABLE ONLY "public"."journal_entries"
ALTER TABLE ONLY "public"."journal_lines"
ALTER TABLE ONLY "public"."nonce_store"
ALTER TABLE ONLY "public"."payment_links"
ALTER TABLE ONLY "public"."payment_merchants"
ALTER TABLE ONLY "public"."payment_vault_addresses"
ALTER TABLE ONLY "public"."profiles"
ALTER TABLE ONLY "public"."transaction_usage_predictions"
ALTER TABLE ONLY "public"."transaction_usages"
ALTER TABLE ONLY "public"."transactions"
ALTER TABLE ONLY "public"."transfers"
ALTER TABLE ONLY "public"."transfers"
ALTER TABLE ONLY "public"."transfers"
ALTER TABLE ONLY "public"."wallet_connections"
    ADD CONSTRAINT "wallet_connections_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."wallet_connections"
ALTER TABLE ONLY "public"."wallets"
CREATE POLICY "Read access for all users" ON "public"."asset_prices" FOR SELECT USING (true);
CREATE POLICY "Update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete their own entities" ON "public"."entities" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete their own wallet connections" ON "public"."wallet_connections" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can manage their own customers" ON "public"."customers" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can manage their own exchange connections" ON "public"."exchange_connections" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can manage their own invoices" ON "public"."invoices" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can select their own exchange trades" ON "public"."exchange_trades" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own crypto payments" ON "public"."crypto_payments" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own entities" ON "public"."entities" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own exchange trades" ON "public"."exchange_trades" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own transactions" ON "public"."transactions" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own wallet connections" ON "public"."wallet_connections" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own wallet transactions" ON "public"."wallet_transactions" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own audit logs" ON "public"."audit_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own crypto payments" ON "public"."crypto_payments" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own entities" ON "public"."entities" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own meter events" ON "public"."meter_events" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own monthly counters" ON "public"."user_monthly_counters" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own sessions" ON "public"."user_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own transactions" ON "public"."transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own wallet connections" ON "public"."wallet_connections" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "allow_authenticated_select_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_update_own_profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_manage_clients" ON "public"."clients" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "allow_user_manage_companies" ON "public"."companies" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "allow_user_manage_exchange_trade_values" ON "public"."exchange_trade_values" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "allow_user_manage_transfers" ON "public"."transfers" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "allow_user_select_crypto_payments" ON "public"."crypto_payments" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_select_customers" ON "public"."customers" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_select_invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_select_own_exchange_connections" ON "public"."exchange_connections" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_select_own_exchange_trades" ON "public"."exchange_trades" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_select_own_wallet_connections" ON "public"."wallet_connections" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_select_own_wallet_transactions" ON "public"."wallet_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_select_transactions" ON "public"."transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_select_wallets" ON "public"."wallet_connections" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_update_customers" ON "public"."customers" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_update_invoices" ON "public"."invoices" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_update_own_exchange_trades" ON "public"."exchange_trades" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_update_own_wallet_transactions" ON "public"."wallet_transactions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_update_wallets" ON "public"."wallet_connections" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
ALTER TABLE "public"."asset_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_delete_usage_labels" ON "public"."transaction_usage_labels" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_delete_wallets" ON "public"."wallet_connections" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_audit_logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_crypto_payments" ON "public"."crypto_payments" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_customers" ON "public"."customers" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_meter_events" ON "public"."meter_events" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_transactions" ON "public"."transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_usage_labels" ON "public"."transaction_usage_labels" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_select_user_monthly_counters" ON "public"."user_monthly_counters" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_user_sessions" ON "public"."user_sessions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_wallet_nonces" ON "public"."wallet_nonces" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_select_wallet_sync" ON "public"."wallet_sync_state" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_select_wallet_tx" ON "public"."wallet_transactions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_select_wallets" ON "public"."wallet_connections" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_select_wallets" ON "public"."wallets" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_update_customers" ON "public"."customers" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_update_invoices" ON "public"."invoices" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_update_profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_update_usage_labels" ON "public"."transaction_usage_labels" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_update_wallets" ON "public"."wallet_connections" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_upsert_wallet_nonces" ON "public"."wallet_nonces" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_upsert_wallet_sync" ON "public"."wallet_sync_state" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_upsert_wallets" ON "public"."wallets" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_select_own" ON "public"."clients" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "clients_upd_own" ON "public"."clients" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_select_own" ON "public"."companies" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "companies_upd_own" ON "public"."companies" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "cred_delete_own" ON "public"."exchange_api_credentials" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "cred_select_own" ON "public"."exchange_api_credentials" FOR SELECT USING (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."crypto_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select_own" ON "public"."customers" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "customers_upd_own" ON "public"."customers" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
ALTER TABLE "public"."entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."exchange_api_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."exchange_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exchange_connections owner rw" ON "public"."exchange_connections" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."exchange_trade_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."exchange_trades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_delete_own" ON "public"."invoices" FOR DELETE USING (("user_id" = "auth"."uid"()));
CREATE POLICY "invoices_select_own" ON "public"."invoices" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "invoices_upd_own" ON "public"."invoices" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "invoices_update_own" ON "public"."invoices" FOR UPDATE USING (("user_id" = "auth"."uid"()));
CREATE POLICY "je_delete_own" ON "public"."journal_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "je_select_own" ON "public"."journal_entries" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "je_select_owner" ON "public"."journal_entries" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "je_self_all" ON "public"."journal_entries" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "je_upd_owner" ON "public"."journal_entries" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "je_update_own" ON "public"."journal_entries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "jl_select_owner" ON "public"."journal_lines" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "jl_upd_owner" ON "public"."journal_lines" FOR UPDATE USING ((EXISTS ( SELECT 1
ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."journal_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "labels_delete_own" ON "public"."transaction_usage_labels" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "labels_select_own" ON "public"."transaction_usage_labels" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "labels_update_own" ON "public"."transaction_usage_labels" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."meter_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."nonce_store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payment_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payment_merchants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payment_vault_addresses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_select_own" ON "public"."payment_links" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "pm_select_own" ON "public"."payment_merchants" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "pm_upsert_own" ON "public"."payment_merchants" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "pred_select_own" ON "public"."transaction_usage_predictions" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "pred_update_own" ON "public"."transaction_usage_predictions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));
CREATE POLICY "profiles_select_owner_only" ON "public"."profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "profiles_update_owner_only" ON "public"."profiles" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "profiles_upsert_own" ON "public"."profiles" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));
CREATE POLICY "tp_select_own" ON "public"."transaction_purposes" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "tp_upsert_own" ON "public"."transaction_purposes" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
ALTER TABLE "public"."transaction_purposes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transaction_usage_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transaction_usage_predictions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transfers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_delete_self" ON "public"."wallet_transactions" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "tx_select_self" ON "public"."wallet_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "tx_update_self" ON "public"."wallet_transactions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "tx_usage_del_owner" ON "public"."transaction_usage_labels" FOR DELETE USING (("user_id" = "auth"."uid"()));
CREATE POLICY "tx_usage_select_owner" ON "public"."transaction_usage_labels" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "tx_usage_upd_owner" ON "public"."transaction_usage_labels" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
ALTER TABLE "public"."user_monthly_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vault_select_own" ON "public"."payment_vault_addresses" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "vault_upd_own" ON "public"."payment_vault_addresses" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "vce_delete_own" ON "public"."exchange_connections" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "vce_select_own" ON "public"."exchange_connections" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "vce_update_own" ON "public"."exchange_connections" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."wallet_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."wallet_nonces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."wallet_sync_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets select own" ON "public"."wallets" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets update own" ON "public"."wallets" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_del_own" ON "public"."wallets" FOR DELETE USING (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_delete_own" ON "public"."wallets" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_delete_self" ON "public"."wallets" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "wallets_sel" ON "public"."wallets" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_select_own" ON "public"."wallets" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_select_self" ON "public"."wallets" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "wallets_upd" ON "public"."wallets" FOR UPDATE USING (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_upd_own" ON "public"."wallets" FOR UPDATE USING (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_update_own" ON "public"."wallets" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_update_self" ON "public"."wallets" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "wt_select_own" ON "public"."wallet_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "wtx_delete_own" ON "public"."wallet_transactions" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "wtx_select_own" ON "public"."wallet_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "wtx_update_own" ON "public"."wallet_transactions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL ON FUNCTION "public"."calculate_wallet_tx_usd_value"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_wallet_tx_usd_value"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_wallet_tx_usd_value"() TO "service_role";
GRANT ALL ON FUNCTION "public"."clear_unused_profile_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."clear_unused_profile_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_unused_profile_fields"() TO "service_role";
GRANT ALL ON FUNCTION "public"."decrypt_secret"("enc_input" "bytea", "key_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_secret"("enc_input" "bytea", "key_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_secret"("enc_input" "bytea", "key_input" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."encrypt_secret"("plain_input" "text", "key_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encrypt_secret"("plain_input" "text", "key_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encrypt_secret"("plain_input" "text", "key_input" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_profiles_mirror_id_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_profiles_mirror_id_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_profiles_mirror_id_user_id"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_decrypted_connection"("p_user_id" "uuid", "p_exchange" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_decrypted_connection"("p_user_id" "uuid", "p_exchange" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_decrypted_connection"("p_user_id" "uuid", "p_exchange" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";
GRANT ALL ON FUNCTION "public"."profiles_align_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_align_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_align_ids"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_invoices_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_invoices_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_invoices_set_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
GRANT ALL ON TABLE "public"."asset_prices" TO "anon";
GRANT ALL ON TABLE "public"."asset_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_prices" TO "service_role";
GRANT ALL ON TABLE "public"."daily_exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."daily_exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_exchange_rates" TO "service_role";
GRANT ALL ON TABLE "public"."entities" TO "anon";
GRANT ALL ON TABLE "public"."entities" TO "authenticated";
GRANT ALL ON TABLE "public"."entities" TO "service_role";
GRANT ALL ON TABLE "public"."exchange_connections" TO "anon";
GRANT ALL ON TABLE "public"."exchange_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_connections" TO "service_role";
GRANT ALL ON TABLE "public"."exchange_trades" TO "anon";
GRANT ALL ON TABLE "public"."exchange_trades" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_trades" TO "service_role";
GRANT ALL ON TABLE "public"."wallet_connections" TO "anon";
GRANT ALL ON TABLE "public"."wallet_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_connections" TO "service_role";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";
GRANT ALL ON TABLE "public"."all_transactions" TO "anon";
GRANT ALL ON TABLE "public"."all_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."all_transactions" TO "service_role";
GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";
GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";
GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";
GRANT ALL ON TABLE "public"."crypto_payments" TO "anon";
GRANT ALL ON TABLE "public"."crypto_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."crypto_payments" TO "service_role";
GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";
GRANT ALL ON TABLE "public"."exchange_accounts" TO "anon";
GRANT ALL ON TABLE "public"."exchange_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_accounts" TO "service_role";
GRANT ALL ON SEQUENCE "public"."exchange_accounts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exchange_accounts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exchange_accounts_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."exchange_api_credentials" TO "anon";
GRANT ALL ON TABLE "public"."exchange_api_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_api_credentials" TO "service_role";
GRANT ALL ON SEQUENCE "public"."exchange_api_credentials_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exchange_api_credentials_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exchange_api_credentials_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."exchange_balances" TO "anon";
GRANT ALL ON TABLE "public"."exchange_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_balances" TO "service_role";
GRANT ALL ON SEQUENCE "public"."exchange_balances_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exchange_balances_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exchange_balances_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."exchange_connections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exchange_connections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exchange_connections_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."exchange_trade_values" TO "anon";
GRANT ALL ON TABLE "public"."exchange_trade_values" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_trade_values" TO "service_role";
GRANT ALL ON TABLE "public"."exchange_transfers" TO "anon";
GRANT ALL ON TABLE "public"."exchange_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_transfers" TO "service_role";
GRANT ALL ON SEQUENCE "public"."exchange_transfers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exchange_transfers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exchange_transfers_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."wallet_tx_norm" TO "anon";
GRANT ALL ON TABLE "public"."wallet_tx_norm" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_tx_norm" TO "service_role";
GRANT ALL ON TABLE "public"."internal_transfer_candidates" TO "anon";
GRANT ALL ON TABLE "public"."internal_transfer_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_transfer_candidates" TO "service_role";
GRANT ALL ON TABLE "public"."internal_transfer_links" TO "anon";
GRANT ALL ON TABLE "public"."internal_transfer_links" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_transfer_links" TO "service_role";
GRANT ALL ON SEQUENCE "public"."internal_transfer_links_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."internal_transfer_links_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."internal_transfer_links_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."internal_transfer_pairs" TO "anon";
GRANT ALL ON TABLE "public"."internal_transfer_pairs" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_transfer_pairs" TO "service_role";
GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";
GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";
GRANT ALL ON SEQUENCE "public"."journal_entries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."journal_entries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."journal_entries_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."journal_lines" TO "anon";
GRANT ALL ON TABLE "public"."journal_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_lines" TO "service_role";
GRANT ALL ON SEQUENCE "public"."journal_lines_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."journal_lines_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."journal_lines_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."meter_events" TO "anon";
GRANT ALL ON TABLE "public"."meter_events" TO "authenticated";
GRANT ALL ON TABLE "public"."meter_events" TO "service_role";
GRANT ALL ON TABLE "public"."nonce_store" TO "anon";
GRANT ALL ON TABLE "public"."nonce_store" TO "authenticated";
GRANT ALL ON TABLE "public"."nonce_store" TO "service_role";
GRANT ALL ON TABLE "public"."payment_links" TO "anon";
GRANT ALL ON TABLE "public"."payment_links" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_links" TO "service_role";
GRANT ALL ON TABLE "public"."payment_merchants" TO "anon";
GRANT ALL ON TABLE "public"."payment_merchants" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_merchants" TO "service_role";
GRANT ALL ON TABLE "public"."payment_vault_addresses" TO "anon";
GRANT ALL ON TABLE "public"."payment_vault_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_vault_addresses" TO "service_role";
GRANT ALL ON SEQUENCE "public"."payment_vault_addresses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payment_vault_addresses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payment_vault_addresses_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT ALL ON TABLE "public"."transaction_purposes" TO "anon";
GRANT ALL ON TABLE "public"."transaction_purposes" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_purposes" TO "service_role";
GRANT ALL ON TABLE "public"."transaction_usage_labels" TO "anon";
GRANT ALL ON TABLE "public"."transaction_usage_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_usage_labels" TO "service_role";
GRANT ALL ON SEQUENCE "public"."transaction_usage_labels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transaction_usage_labels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transaction_usage_labels_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."transaction_usage_predictions" TO "anon";
GRANT ALL ON TABLE "public"."transaction_usage_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_usage_predictions" TO "service_role";
GRANT ALL ON TABLE "public"."transaction_usages" TO "anon";
GRANT ALL ON TABLE "public"."transaction_usages" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_usages" TO "service_role";
GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";
GRANT ALL ON TABLE "public"."transfer_links" TO "anon";
GRANT ALL ON TABLE "public"."transfer_links" TO "authenticated";
GRANT ALL ON TABLE "public"."transfer_links" TO "service_role";
GRANT ALL ON SEQUENCE "public"."transfer_links_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transfer_links_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transfer_links_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."transfers" TO "anon";
GRANT ALL ON TABLE "public"."transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."transfers" TO "service_role";
GRANT ALL ON TABLE "public"."usage_categories" TO "anon";
GRANT ALL ON TABLE "public"."usage_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_categories" TO "service_role";
GRANT ALL ON TABLE "public"."user_monthly_counters" TO "anon";
GRANT ALL ON TABLE "public"."user_monthly_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."user_monthly_counters" TO "service_role";
GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";
GRANT ALL ON TABLE "public"."v_all_transactions_classified" TO "anon";
GRANT ALL ON TABLE "public"."v_all_transactions_classified" TO "authenticated";
GRANT ALL ON TABLE "public"."v_all_transactions_classified" TO "service_role";
GRANT ALL ON TABLE "public"."v_holdings" TO "anon";
GRANT ALL ON TABLE "public"."v_holdings" TO "authenticated";
GRANT ALL ON TABLE "public"."v_holdings" TO "service_role";
GRANT ALL ON TABLE "public"."v_balance_sheet" TO "anon";
GRANT ALL ON TABLE "public"."v_balance_sheet" TO "authenticated";
GRANT ALL ON TABLE "public"."v_balance_sheet" TO "service_role";
GRANT ALL ON TABLE "public"."v_cash_flow_statement" TO "anon";
GRANT ALL ON TABLE "public"."v_cash_flow_statement" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cash_flow_statement" TO "service_role";
GRANT ALL ON TABLE "public"."v_profit_loss_statement" TO "anon";
GRANT ALL ON TABLE "public"."v_profit_loss_statement" TO "authenticated";
GRANT ALL ON TABLE "public"."v_profit_loss_statement" TO "service_role";
GRANT ALL ON TABLE "public"."wallet_nonces" TO "anon";
GRANT ALL ON TABLE "public"."wallet_nonces" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_nonces" TO "service_role";
GRANT ALL ON TABLE "public"."wallet_sync_state" TO "anon";
GRANT ALL ON TABLE "public"."wallet_sync_state" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_sync_state" TO "service_role";
GRANT ALL ON TABLE "public"."wallet_transaction" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transaction" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transaction" TO "service_role";
GRANT ALL ON SEQUENCE "public"."wallet_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wallet_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wallet_transactions_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."wallet_tx_with_flags" TO "anon";
GRANT ALL ON TABLE "public"."wallet_tx_with_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_tx_with_flags" TO "service_role";
GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
