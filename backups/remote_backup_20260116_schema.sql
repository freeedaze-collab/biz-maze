


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."us_entity_type_enum" AS ENUM (
    'C Corporation',
    'S Corporation',
    'LLC',
    'Partnership',
    'PC/PA',
    'PBC'
);


ALTER TYPE "public"."us_entity_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."us_state_of_incorporation_enum" AS ENUM (
    'Alabama',
    'Alaska',
    'Arizona',
    'Wyoming',
    'District of Columbia'
);


ALTER TYPE "public"."us_state_of_incorporation_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_wallet_tx_usd_value"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."calculate_wallet_tx_usd_value"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_unused_profile_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Clear corporation-specific fields unless US & Corporation
  IF NOT (NEW.region = 'United States' AND NEW.account_type = 'Corporation') THEN
    NEW.entity_type := NULL;
    NEW.state_of_incorporation := NULL;
  END IF;

  -- Clear income bracket unless region is Japan
  IF NEW.region <> 'Japan' THEN
    NEW.income_bracket := NULL;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."clear_unused_profile_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_secret"("enc_input" "bytea", "key_input" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select pgp_sym_decrypt(enc_input, key_input);
$$;


ALTER FUNCTION "public"."decrypt_secret"("enc_input" "bytea", "key_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encrypt_secret"("plain_input" "text", "key_input" "text") RETURNS "bytea"
    LANGUAGE "sql"
    AS $$
  select pgp_sym_encrypt(plain_input, key_input, 'cipher-algo=aes256');
$$;


ALTER FUNCTION "public"."encrypt_secret"("plain_input" "text", "key_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_profiles_mirror_id_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.user_id is null and NEW.id is not null then
    NEW.user_id := NEW.id;
  end if;

  if NEW.id is null and NEW.user_id is not null then
    NEW.id := NEW.user_id;
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_profiles_mirror_id_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_decrypted_connection"("p_user_id" "uuid", "p_exchange" "text") RETURNS TABLE("api_key" "text", "api_secret" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'decrypted', 'public'
    AS $$
BEGIN
  -- Vaultが提供する復号化済みビューの、正しい名前「decrypted.exchange_connections」を直接参照する。
  -- 私が勝手に追加していた「_decrypted」という接尾辞が、全ての元凶でした。
  RETURN QUERY
  SELECT
    v.api_key,
    v.api_secret
  FROM
    decrypted.exchange_connections AS v -- ここが「exchange_connections_decrypted」ではなく「exchange_connections」だった
  WHERE
    v.user_id = p_user_id AND v.exchange = p_exchange;
END;
$$;


ALTER FUNCTION "public"."get_decrypted_connection"("p_user_id" "uuid", "p_exchange" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Insert a new row into public.profiles, copying the id and email
  -- from the newly created user in auth.users.
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_align_ids"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    begin
      if NEW.user_id is null then
        raise exception 'profiles.user_id must not be null';
      end if;
      -- if id is null or not equal, align id to user_id for consistency
      if NEW.id is null or NEW.id <> NEW.user_id then
        NEW.id := NEW.user_id;
      end if;
      return NEW;
    end;
    $$;


ALTER FUNCTION "public"."profiles_align_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_invoices_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    begin
      new.updated_at := now();
      return new;
    end
    $$;


ALTER FUNCTION "public"."tg_invoices_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."asset_prices" (
    "asset" "text" NOT NULL,
    "current_price" numeric NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."asset_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_exchange_rates" (
    "date" "date" NOT NULL,
    "source_currency" "text" NOT NULL,
    "target_currency" "text" NOT NULL,
    "rate" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_exchange_rates" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_exchange_rates" IS 'Stores daily historical exchange rates for converting transaction values into a common currency like USD.';



COMMENT ON COLUMN "public"."daily_exchange_rates"."date" IS 'The specific date for which the exchange rate is valid.';



COMMENT ON COLUMN "public"."daily_exchange_rates"."source_currency" IS 'The original currency of the transaction (e.g., JPY, EUR).';



COMMENT ON COLUMN "public"."daily_exchange_rates"."target_currency" IS 'The target currency for conversion (e.g., USD).';



COMMENT ON COLUMN "public"."daily_exchange_rates"."rate" IS 'The market rate for converting one unit of the source currency into the target currency.';



CREATE TABLE IF NOT EXISTS "public"."entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "parent_id" "uuid",
    "is_default" boolean DEFAULT false,
    "country" "text",
    "currency" "text" DEFAULT 'USD'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_head_office" boolean DEFAULT false,
    CONSTRAINT "entities_type_check" CHECK (("type" = ANY (ARRAY['personal'::"text", 'subsidiary'::"text"])))
);


ALTER TABLE "public"."entities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_connections" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exchange" "text" NOT NULL,
    "label" "text",
    "api_key" "text",
    "api_secret" "text",
    "oauth_provider" "text",
    "oauth_access_token" "text",
    "oauth_refresh_token" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "external_user_id" "text",
    "status" "text" DEFAULT 'linked'::"text",
    "connection_name" "text" NOT NULL,
    "encrypted_blob" "text",
    "entity_id" "uuid"
);


ALTER TABLE "public"."exchange_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exchange" "text" NOT NULL,
    "symbol" "text" NOT NULL,
    "side" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "price" numeric NOT NULL,
    "fee" numeric,
    "fee_currency" "text",
    "external_id" "text",
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "trade_id" "text" NOT NULL,
    "fee_asset" "text",
    "ts" timestamp with time zone NOT NULL,
    "value_usd" numeric,
    "exchange_connection_id" bigint,
    "usage" "text",
    "note" "text"
);


ALTER TABLE "public"."exchange_trades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "wallet_type" "text" NOT NULL,
    "wallet_name" "text",
    "is_primary" boolean DEFAULT false,
    "balance_usd" numeric(20,8) DEFAULT 0,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verification_status" "text" DEFAULT 'unverified'::"text",
    "verified_at" timestamp with time zone,
    "verification_signature" "text",
    "chain_last_synced_at" "jsonb" DEFAULT '{}'::"jsonb",
    "chain" "text",
    "network" "text",
    "entity_id" "uuid"
);


ALTER TABLE "public"."wallet_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "chain_id" bigint DEFAULT 1 NOT NULL,
    "direction" "text" NOT NULL,
    "tx_hash" "text" NOT NULL,
    "block_number" bigint,
    "timestamp" timestamp with time zone,
    "from_address" "text",
    "to_address" "text",
    "value_wei" numeric,
    "asset_symbol" "text",
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asset_decimals" smallint DEFAULT 18,
    "price_usd" numeric,
    "fiat_value_usd" numeric,
    "occurred_at" timestamp with time zone,
    "usd_value_at_tx" numeric,
    "value_usd" numeric,
    "usage" "text",
    "note" "text",
    "amount" numeric,
    "chain" "text",
    "date" timestamp with time zone,
    "asset" "text",
    "value_in_usd" numeric,
    "type" "text",
    "description" "text",
    "source" "text",
    "fee" numeric,
    "fee_currency" "text",
    "nonce" bigint,
    "method_id" "text",
    "block_timestamp" timestamp with time zone,
    "status" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."all_transactions" AS
 WITH "latest_fiat_rates" AS (
         SELECT DISTINCT ON ("daily_exchange_rates"."target_currency") "daily_exchange_rates"."target_currency",
            "daily_exchange_rates"."rate"
           FROM "public"."daily_exchange_rates"
          WHERE (("daily_exchange_rates"."source_currency" = 'USD'::"text") AND ("daily_exchange_rates"."target_currency" = ANY (ARRAY['JPY'::"text", 'EUR'::"text", 'GBP'::"text", 'INR'::"text", 'SGD'::"text"])))
          ORDER BY "daily_exchange_rates"."target_currency", "daily_exchange_rates"."date" DESC
        ), "jpy_to_usd" AS (
         SELECT COALESCE((1.0 / NULLIF("daily_exchange_rates"."rate", (0)::numeric)), 0.0066) AS "rate"
           FROM "public"."daily_exchange_rates"
          WHERE (("daily_exchange_rates"."source_currency" = 'USD'::"text") AND ("daily_exchange_rates"."target_currency" = 'JPY'::"text"))
          ORDER BY "daily_exchange_rates"."date" DESC
         LIMIT 1
        ), "base_transactions" AS (
         SELECT "t"."id",
            "t"."user_id",
            "t"."reference_id",
            "t"."date",
            "t"."source",
            "t"."chain",
            "t"."description",
            "t"."amount",
            "t"."asset",
            "t"."price",
            "t"."raw_value_usd",
            "t"."usage",
            "t"."note",
            "t"."type",
            "t"."connection_id",
            "t"."quote_asset",
            "t"."wallet_address",
            "t"."connection_name"
           FROM ( SELECT ("wt"."id")::"text" AS "reference_id",
                    ('w_'::"text" || "wt"."id") AS "id",
                    "wt"."user_id",
                    "wt"."timestamp" AS "date",
                    'wallet'::"text" AS "source",
                    "wc_1"."chain",
                    'Wallet Transaction'::"text" AS "description",
                    "wt"."amount",
                    "wt"."asset",
                        CASE
                            WHEN (("wt"."amount" IS NULL) OR ("wt"."amount" = (0)::numeric)) THEN (0)::numeric
                            ELSE ("wt"."value_in_usd" / "wt"."amount")
                        END AS "price",
                    "wt"."value_in_usd" AS "raw_value_usd",
                    "wt"."usage",
                    "wt"."note",
                    "wt"."type",
                    ("wc_1"."id")::"text" AS "connection_id",
                    NULL::"text" AS "quote_asset",
                    "wt"."wallet_address",
                    NULL::"text" AS "connection_name"
                   FROM ("public"."wallet_transactions" "wt"
                     JOIN "public"."wallet_connections" "wc_1" ON ((("wt"."wallet_address" = "wc_1"."wallet_address") AND ("wt"."user_id" = "wc_1"."user_id"))))
                UNION ALL
                 SELECT "et"."trade_id" AS "reference_id",
                    ('e_'::"text" || "et"."trade_id") AS "id",
                    "et"."user_id",
                    "et"."ts" AS "date",
                    'exchange'::"text" AS "source",
                    "ec"."exchange" AS "chain",
                    'Exchange Trade'::"text" AS "description",
                        CASE
                            WHEN ("et"."side" = 'sell'::"text") THEN
                            CASE
                                WHEN ("et"."fee_currency" ~ '^[0-9]+\.?[0-9]*$'::"text") THEN ("et"."fee_currency")::numeric
                                ELSE "et"."amount"
                            END
                            ELSE "et"."amount"
                        END AS "amount",
                        CASE
                            WHEN ("et"."symbol" ~~ '%/%'::"text") THEN "split_part"("et"."symbol", '/'::"text", 1)
                            ELSE "et"."symbol"
                        END AS "asset",
                    "et"."price",
                        CASE
                            WHEN ("et"."symbol" ~~ '%/JPY'::"text") THEN
                            CASE
                                WHEN ("et"."side" = 'sell'::"text") THEN ("et"."amount" * ( SELECT "jpy_to_usd"."rate"
                                   FROM "jpy_to_usd"))
                                WHEN ("et"."side" = 'buy'::"text") THEN
                                CASE
                                    WHEN ("et"."fee_currency" ~ '^[0-9]+\.?[0-9]*$'::"text") THEN (("et"."fee_currency")::numeric * ( SELECT "jpy_to_usd"."rate"
                                       FROM "jpy_to_usd"))
                                    ELSE NULL::numeric
                                END
                                ELSE "et"."value_usd"
                            END
                            WHEN ("et"."side" ~~* 'withdraw%'::"text") THEN ("et"."amount" * COALESCE(( SELECT "ap"."current_price"
                               FROM "public"."asset_prices" "ap"
                              WHERE ("upper"("ap"."asset") = "upper"(
                                    CASE
WHEN ("et"."symbol" ~~ '%/%'::"text") THEN "split_part"("et"."symbol", '/'::"text", 1)
ELSE "et"."symbol"
                                    END))), (0)::numeric))
                            ELSE COALESCE("et"."value_usd", ("et"."price" * "et"."amount"))
                        END AS "raw_value_usd",
                    "et"."usage",
                    "et"."note",
                    "et"."side" AS "type",
                    ("ec"."id")::"text" AS "connection_id",
                        CASE
                            WHEN ("et"."symbol" ~~ '%/%'::"text") THEN "split_part"("et"."symbol", '/'::"text", 2)
                            ELSE NULL::"text"
                        END AS "quote_asset",
                    NULL::"text" AS "wallet_address",
                    "ec"."connection_name"
                   FROM ("public"."exchange_trades" "et"
                     JOIN "public"."exchange_connections" "ec" ON (("et"."exchange_connection_id" = "ec"."id")))) "t"
        )
 SELECT "bt"."id",
    "bt"."user_id",
    "bt"."reference_id",
    "bt"."date",
    "bt"."source",
    "bt"."chain",
    "bt"."description",
    "bt"."amount",
    "bt"."asset",
    "bt"."price",
    "bt"."raw_value_usd" AS "value_usd",
    ("bt"."raw_value_usd" * COALESCE(( SELECT "latest_fiat_rates"."rate"
           FROM "latest_fiat_rates"
          WHERE ("latest_fiat_rates"."target_currency" = 'JPY'::"text")), (152)::numeric)) AS "value_jpy",
    ("bt"."raw_value_usd" * COALESCE(( SELECT "latest_fiat_rates"."rate"
           FROM "latest_fiat_rates"
          WHERE ("latest_fiat_rates"."target_currency" = 'EUR'::"text")), 0.94)) AS "value_eur",
    "bt"."type",
    "bt"."usage",
    "bt"."note",
        CASE
            WHEN ("bt"."source" = 'wallet'::"text") THEN "wc"."entity_id"
            WHEN ("bt"."source" = 'exchange'::"text") THEN "xc"."entity_id"
            ELSE NULL::"uuid"
        END AS "entity_id",
        CASE
            WHEN ("bt"."source" = 'wallet'::"text") THEN "e_w"."name"
            WHEN ("bt"."source" = 'exchange'::"text") THEN "e_e"."name"
            ELSE NULL::"text"
        END AS "entity_name",
    "bt"."quote_asset",
    "bt"."wallet_address",
    "bt"."connection_name",
    "bt"."connection_id"
   FROM (((("base_transactions" "bt"
     LEFT JOIN "public"."wallet_connections" "wc" ON ((("bt"."source" = 'wallet'::"text") AND ("bt"."connection_id" = ("wc"."id")::"text"))))
     LEFT JOIN "public"."exchange_connections" "xc" ON ((("bt"."source" = 'exchange'::"text") AND ("bt"."connection_id" = ("xc"."id")::"text"))))
     LEFT JOIN "public"."entities" "e_w" ON (("wc"."entity_id" = "e_w"."id")))
     LEFT JOIN "public"."entities" "e_e" ON (("xc"."entity_id" = "e_e"."id")));


ALTER VIEW "public"."all_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "country" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "wallet" "text"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "country" "text",
    "tax_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crypto_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "invoice_id" "text",
    "recipient_address" "text" NOT NULL,
    "amount" numeric(20,8) NOT NULL,
    "currency" "text" NOT NULL,
    "usd_amount" numeric(20,2),
    "payment_status" "text" DEFAULT 'pending'::"text",
    "transaction_hash" "text",
    "wallet_address" "text",
    "gas_fee" numeric(20,8),
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."crypto_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "company" "text",
    "address" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_accounts" (
    "id" bigint NOT NULL,
    "connection_id" bigint,
    "account_uid" "text" NOT NULL,
    "type" "text"
);


ALTER TABLE "public"."exchange_accounts" OWNER TO "postgres";


ALTER TABLE "public"."exchange_accounts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exchange_accounts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."exchange_api_credentials" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exchange" "text" NOT NULL,
    "external_user_id" "text",
    "enc_blob" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exchange_api_credentials_exchange_check" CHECK (("exchange" = ANY (ARRAY['binance'::"text", 'bybit'::"text", 'okx'::"text"])))
);


ALTER TABLE "public"."exchange_api_credentials" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."exchange_api_credentials_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exchange_api_credentials_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exchange_api_credentials_id_seq" OWNED BY "public"."exchange_api_credentials"."id";



CREATE TABLE IF NOT EXISTS "public"."exchange_balances" (
    "id" bigint NOT NULL,
    "account_id" bigint,
    "asset" "text" NOT NULL,
    "free" numeric,
    "locked" numeric,
    "total" numeric,
    "at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."exchange_balances" OWNER TO "postgres";


ALTER TABLE "public"."exchange_balances" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exchange_balances_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."exchange_connections" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exchange_connections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."exchange_trade_values" (
    "exchange_trade_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "asset" "text",
    "symbol" "text",
    "base_amount" numeric,
    "price_usd" numeric,
    "fiat_value_usd" numeric,
    "fee" numeric,
    "fee_asset" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exchange_trade_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_transfers" (
    "id" bigint NOT NULL,
    "account_id" bigint,
    "direction" "text",
    "asset" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "txid" "text",
    "network" "text",
    "occurred_at" timestamp with time zone NOT NULL,
    "raw" "jsonb",
    CONSTRAINT "exchange_transfers_direction_check" CHECK (("direction" = ANY (ARRAY['deposit'::"text", 'withdraw'::"text"])))
);


ALTER TABLE "public"."exchange_transfers" OWNER TO "postgres";


ALTER TABLE "public"."exchange_transfers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exchange_transfers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."wallet_tx_norm" AS
 SELECT "id",
    "user_id",
    (("to_jsonb"("t".*) ->> 'chain_id'::"text"))::integer AS "chain_id",
    "lower"(COALESCE(("to_jsonb"("t".*) ->> 'direction'::"text"), ''::"text")) AS "direction",
    "lower"(COALESCE(("to_jsonb"("t".*) ->> 'wallet_address'::"text"), ("to_jsonb"("t".*) ->> 'from'::"text"), ("to_jsonb"("t".*) ->> 'from_address'::"text"))) AS "wallet_address",
    "lower"(COALESCE(("to_jsonb"("t".*) ->> 'counterparty_address'::"text"), ("to_jsonb"("t".*) ->> 'to'::"text"), ("to_jsonb"("t".*) ->> 'to_address'::"text"))) AS "counterparty_address",
    COALESCE((NULLIF(("to_jsonb"("t".*) ->> 'amount'::"text"), ''::"text"))::numeric, (NULLIF(("to_jsonb"("t".*) ->> 'value'::"text"), ''::"text"))::numeric, (NULLIF(("to_jsonb"("t".*) ->> 'qty'::"text"), ''::"text"))::numeric, (0)::numeric) AS "amount",
    COALESCE((NULLIF(("to_jsonb"("t".*) ->> 'occurred_at'::"text"), ''::"text"))::timestamp with time zone, (NULLIF(("to_jsonb"("t".*) ->> 'block_time'::"text"), ''::"text"))::timestamp with time zone, (NULLIF(("to_jsonb"("t".*) ->> 'timestamp'::"text"), ''::"text"))::timestamp with time zone, (NULLIF(("to_jsonb"("t".*) ->> 'created_at'::"text"), ''::"text"))::timestamp with time zone, "now"()) AS "occurred_at",
    COALESCE(("to_jsonb"("t".*) ->> 'tx_hash'::"text"), ("to_jsonb"("t".*) ->> 'transaction_hash'::"text"), ("to_jsonb"("t".*) ->> 'hash'::"text")) AS "tx_hash"
   FROM "public"."wallet_transactions" "t";


ALTER VIEW "public"."wallet_tx_norm" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."internal_transfer_candidates" AS
 SELECT "o"."id" AS "out_tx_id",
    "i"."id" AS "in_tx_id",
    "o"."user_id",
    "o"."chain_id",
    "abs"(("o"."amount" - "i"."amount")) AS "amount_delta",
        CASE
            WHEN (GREATEST("o"."amount", "i"."amount") = (0)::numeric) THEN (0)::numeric
            ELSE ("abs"(("o"."amount" - "i"."amount")) / GREATEST("o"."amount", "i"."amount"))
        END AS "amount_delta_rate",
    "abs"(EXTRACT(epoch FROM ("i"."occurred_at" - "o"."occurred_at"))) AS "diff_seconds",
        CASE
            WHEN (("o"."tx_hash" IS NOT NULL) AND ("o"."tx_hash" = "i"."tx_hash")) THEN 'same_tx_hash'::"text"
            WHEN (("o"."counterparty_address" IS NOT NULL) AND ("o"."counterparty_address" = "i"."wallet_address")) THEN 'out->in_addr_match'::"text"
            WHEN (("i"."counterparty_address" IS NOT NULL) AND ("i"."counterparty_address" = "o"."wallet_address")) THEN 'in->out_addr_match'::"text"
            ELSE 'amount_time_heuristic'::"text"
        END AS "reason"
   FROM ("public"."wallet_tx_norm" "o"
     JOIN "public"."wallet_tx_norm" "i" ON ((("o"."user_id" = "i"."user_id") AND (("o"."chain_id" IS NULL) OR ("i"."chain_id" IS NULL) OR ("o"."chain_id" = "i"."chain_id")) AND (COALESCE("o"."direction", ''::"text") ~~ 'out%'::"text") AND (COALESCE("i"."direction", ''::"text") ~~ 'in%'::"text") AND (("abs"(("o"."amount" - "i"."amount")) <= 0.000001) OR (
        CASE
            WHEN (GREATEST("o"."amount", "i"."amount") = (0)::numeric) THEN (0)::numeric
            ELSE ("abs"(("o"."amount" - "i"."amount")) / GREATEST("o"."amount", "i"."amount"))
        END <= 0.005)) AND ("abs"(EXTRACT(epoch FROM ("i"."occurred_at" - "o"."occurred_at"))) <= (7200)::numeric) AND ("o"."id" <> "i"."id"))));


ALTER VIEW "public"."internal_transfer_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_transfer_links" (
    "id" bigint NOT NULL,
    "out_tx_id" bigint NOT NULL,
    "in_tx_id" bigint NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."internal_transfer_links" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."internal_transfer_links_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."internal_transfer_links_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."internal_transfer_links_id_seq" OWNED BY "public"."internal_transfer_links"."id";



CREATE OR REPLACE VIEW "public"."internal_transfer_pairs" AS
 SELECT "tx_out"."user_id",
    "tx_out"."id" AS "withdrawal_id",
    "tx_in"."id" AS "deposit_id"
   FROM ("public"."all_transactions" "tx_out"
     JOIN "public"."all_transactions" "tx_in" ON ((("tx_out"."user_id" = "tx_in"."user_id") AND ("tx_out"."asset" = "tx_in"."asset") AND (("tx_out"."type" ~~* 'withdraw%'::"text") OR ("tx_out"."type" = 'send'::"text")) AND (("tx_in"."type" ~~* 'deposit%'::"text") OR ("tx_in"."type" = 'receive'::"text")) AND (("tx_in"."amount" >= ("tx_out"."amount" * 0.999)) AND ("tx_in"."amount" <= "tx_out"."amount")) AND ("tx_in"."date" > "tx_out"."date") AND ("tx_in"."date" <= ("tx_out"."date" + '12:00:00'::interval)) AND (COALESCE("tx_out"."connection_name", "tx_out"."wallet_address") <> COALESCE("tx_in"."connection_name", "tx_in"."wallet_address")))));


ALTER VIEW "public"."internal_transfer_pairs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "invoice_number" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "memo" "text",
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    "client_id" "uuid",
    "customer_name" "text",
    "items" "jsonb",
    "issue_date" "date" DEFAULT CURRENT_DATE,
    "notes" "text",
    "tax_rate" numeric(5,2),
    "billing_address" "text",
    "company_address" "text",
    "company_wallet_address" "text",
    "number" "text",
    "subtotal" numeric,
    "tax" numeric,
    "total" numeric
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tx_id" bigint,
    "entry_date" "date" NOT NULL,
    "account" "text" NOT NULL,
    "dc" character(1) NOT NULL,
    "amount" numeric(78,18) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "memo" "text"
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."journal_entries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."journal_entries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."journal_entries_id_seq" OWNED BY "public"."journal_entries"."id";



CREATE TABLE IF NOT EXISTS "public"."journal_lines" (
    "id" bigint NOT NULL,
    "entry_id" bigint NOT NULL,
    "account_code" "text" NOT NULL,
    "debit" numeric DEFAULT 0 NOT NULL,
    "credit" numeric DEFAULT 0 NOT NULL,
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."journal_lines" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."journal_lines_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."journal_lines_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."journal_lines_id_seq" OWNED BY "public"."journal_lines"."id";



CREATE TABLE IF NOT EXISTS "public"."meter_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "amount" numeric,
    "currency" "text",
    "cost" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meter_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nonce_store" (
    "user_id" "uuid" NOT NULL,
    "nonce" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nonce_store" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "amount" numeric,
    "currency" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_merchants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "store_name" "text",
    "default_currency" "text",
    "allowed_networks" "text"[],
    "webhook_secret" "text",
    "webhook_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_merchants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_vault_addresses" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "network" "text" NOT NULL,
    "asset" "text" NOT NULL,
    "address" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_vault_addresses" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."payment_vault_addresses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."payment_vault_addresses_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."payment_vault_addresses_id_seq" OWNED BY "public"."payment_vault_addresses"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "email" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tax_country" "text",
    "entity_type" "text",
    "seats_limit" integer DEFAULT 1,
    "plan_type" "text" DEFAULT 'individual_free'::"text",
    "account_type" "text" DEFAULT 'individual'::"text",
    "primary_wallet" "text",
    "verify_nonce" "text",
    "country" "text",
    "gateway_enabled" boolean DEFAULT false,
    "state_of_incorporation" "text",
    "income_bracket" "text",
    "us_entity_type" "text",
    "us_state_of_incorporation" "text",
    "region" "text",
    "company_name" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_purposes" (
    "user_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transaction_purposes_source_check" CHECK (("source" = ANY (ARRAY['wallet'::"text", 'exchange'::"text"])))
);


ALTER TABLE "public"."transaction_purposes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_usage_labels" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tx_id" bigint,
    "ctx_id" "text",
    "usage_key" "text",
    "confidence" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transaction_usage_labels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transaction_usage_labels_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transaction_usage_labels_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transaction_usage_labels_id_seq" OWNED BY "public"."transaction_usage_labels"."id";



CREATE TABLE IF NOT EXISTS "public"."transaction_usage_predictions" (
    "user_id" "uuid" NOT NULL,
    "tx_id" bigint NOT NULL,
    "model" "text" DEFAULT 'rule'::"text" NOT NULL,
    "label" "text" NOT NULL,
    "score" numeric(6,5) DEFAULT 1.0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transaction_usage_predictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_usages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "source_type" "text",
    "source_id" "text" NOT NULL,
    "usage_predicted" "text",
    "usage_manual" "text",
    "confidence" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "transaction_usages_source_type_check" CHECK (("source_type" = ANY (ARRAY['wallet'::"text", 'exchange'::"text"])))
);


ALTER TABLE "public"."transaction_usages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "transaction_hash" "text" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "amount" numeric(20,8) NOT NULL,
    "currency" "text" NOT NULL,
    "usd_value" numeric(20,2),
    "from_address" "text",
    "to_address" "text",
    "gas_fee" numeric(20,8),
    "gas_fee_usd" numeric(20,2),
    "block_number" bigint,
    "transaction_status" "text" DEFAULT 'pending'::"text",
    "blockchain_network" "text" NOT NULL,
    "transaction_date" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "chain_id" integer,
    "network" "text",
    "log_index" integer DEFAULT 0,
    "direction" "text",
    "type" "text",
    "asset_contract" "text",
    "asset_symbol" "text",
    "asset_decimals" integer,
    "fee_native" numeric,
    "usd_value_at_tx" numeric,
    "usd_fee_at_tx" numeric,
    "price_source" "text",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "transactions_direction_check" CHECK (("direction" = ANY (ARRAY['in'::"text", 'out'::"text", 'self'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['native'::"text", 'erc20'::"text", 'erc721'::"text", 'erc1155'::"text", 'swap'::"text", 'bridge'::"text", 'fee'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transfer_links" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_tx_id" bigint NOT NULL,
    "exchange_transfer_id" bigint NOT NULL,
    "confidence" real NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transfer_links" OWNER TO "postgres";


ALTER TABLE "public"."transfer_links" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."transfer_links_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."transfers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "client_id" "uuid",
    "invoice_id" "uuid",
    "wallet_address" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'ETH'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_categories" (
    "key" "text" NOT NULL,
    "ifrs_standard" "text",
    "description" "text"
);


ALTER TABLE "public"."usage_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_monthly_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month_year" "text" NOT NULL,
    "event_count" integer DEFAULT 0,
    "total_cost" numeric DEFAULT 0,
    "bundles_used" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_monthly_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "device_fingerprint" "text",
    "first_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_all_transactions_classified" AS
 WITH "all_internal_ids" AS (
         SELECT "internal_transfer_pairs"."withdrawal_id" AS "id"
           FROM "public"."internal_transfer_pairs"
        UNION
         SELECT "internal_transfer_pairs"."deposit_id" AS "id"
           FROM "public"."internal_transfer_pairs"
        )
 SELECT "t"."id",
    "t"."user_id",
    "t"."reference_id",
    "t"."date",
    "t"."source",
    "t"."chain",
    "t"."description",
    "t"."amount",
    "t"."asset",
    "t"."price",
    "t"."value_usd",
    "t"."value_jpy",
    "t"."value_eur",
    "t"."type",
    "t"."usage",
    "t"."note",
    "t"."entity_id",
    "t"."entity_name",
    "t"."quote_asset",
    "t"."wallet_address",
    "t"."connection_name",
    "t"."connection_id",
        CASE
            WHEN ("ai"."id" IS NOT NULL) THEN 'INTERNAL_TRANSFER'::"text"
            WHEN ("t"."type" = ANY (ARRAY['buy'::"text", 'sell'::"text"])) THEN "upper"("t"."type")
            WHEN (("t"."type" ~~* 'deposit%'::"text") OR ("t"."type" ~~* 'receive%'::"text")) THEN 'DEPOSIT'::"text"
            WHEN (("t"."type" ~~* 'withdraw%'::"text") OR ("t"."type" ~~* 'send%'::"text")) THEN 'WITHDRAWAL'::"text"
            ELSE 'OTHER'::"text"
        END AS "transaction_type"
   FROM ("public"."all_transactions" "t"
     LEFT JOIN "all_internal_ids" "ai" ON (("t"."id" = "ai"."id")));


ALTER VIEW "public"."v_all_transactions_classified" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_holdings" AS
 WITH "latest_rates" AS (
         SELECT DISTINCT ON ("daily_exchange_rates"."target_currency") "daily_exchange_rates"."target_currency",
            "daily_exchange_rates"."rate"
           FROM "public"."daily_exchange_rates"
          WHERE (("daily_exchange_rates"."source_currency" = 'USD'::"text") AND ("daily_exchange_rates"."target_currency" = ANY (ARRAY['JPY'::"text", 'EUR'::"text", 'GBP'::"text", 'INR'::"text", 'SGD'::"text"])))
          ORDER BY "daily_exchange_rates"."target_currency", "daily_exchange_rates"."date" DESC
        ), "current_quantities" AS (
         SELECT "v_all_transactions_classified"."user_id",
            "v_all_transactions_classified"."entity_id",
            "v_all_transactions_classified"."entity_name",
            "v_all_transactions_classified"."asset",
            "sum"(
                CASE
                    WHEN ("upper"("v_all_transactions_classified"."type") = ANY (ARRAY['IN'::"text", 'DEPOSIT'::"text", 'BUY'::"text", 'RECEIVE'::"text"])) THEN "v_all_transactions_classified"."amount"
                    WHEN ("upper"("v_all_transactions_classified"."type") = ANY (ARRAY['OUT'::"text", 'WITHDRAWAL'::"text", 'SELL'::"text", 'SEND'::"text"])) THEN (- "v_all_transactions_classified"."amount")
                    ELSE (0)::numeric
                END) AS "current_amount"
           FROM "public"."v_all_transactions_classified"
          WHERE ("v_all_transactions_classified"."transaction_type" <> 'INTERNAL_TRANSFER'::"text")
          GROUP BY "v_all_transactions_classified"."user_id", "v_all_transactions_classified"."entity_id", "v_all_transactions_classified"."entity_name", "v_all_transactions_classified"."asset"
        )
 SELECT "cq"."user_id",
    "cq"."entity_id",
    "cq"."entity_name" AS "entity",
    "cq"."asset",
    "cq"."current_amount",
    COALESCE("ap"."current_price", (0)::numeric) AS "current_price",
    ("cq"."current_amount" * COALESCE("ap"."current_price", (0)::numeric)) AS "current_value_usd",
    (("cq"."current_amount" * COALESCE("ap"."current_price", (0)::numeric)) * COALESCE(( SELECT "latest_rates"."rate"
           FROM "latest_rates"
          WHERE ("latest_rates"."target_currency" = 'JPY'::"text")), (1)::numeric)) AS "current_value_jpy",
    (("cq"."current_amount" * COALESCE("ap"."current_price", (0)::numeric)) * COALESCE(( SELECT "latest_rates"."rate"
           FROM "latest_rates"
          WHERE ("latest_rates"."target_currency" = 'EUR'::"text")), (1)::numeric)) AS "current_value_eur",
    "now"() AS "last_updated"
   FROM ("current_quantities" "cq"
     LEFT JOIN "public"."asset_prices" "ap" ON ((TRIM(BOTH FROM "upper"("cq"."asset")) = TRIM(BOTH FROM "upper"("ap"."asset")))))
  WHERE ("cq"."current_amount" > 0.000000001);


ALTER VIEW "public"."v_holdings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_balance_sheet" AS
 SELECT "user_id",
    "entity_id",
    "entity" AS "entity_name",
    "timezone"('utc'::"text", "now"()) AS "date",
    'Cryptocurrency Assets'::"text" AS "account",
    "current_value_usd" AS "balance",
    "current_value_usd" AS "balance_usd",
    "current_value_jpy" AS "balance_jpy",
    "current_value_eur" AS "balance_eur"
   FROM "public"."v_holdings";


ALTER VIEW "public"."v_balance_sheet" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_cash_flow_statement" AS
 SELECT "v_all_transactions_classified"."user_id",
    "v_all_transactions_classified"."entity_id",
    "v_all_transactions_classified"."entity_name" AS "entity",
    "now"() AS "date",
    'Net Income (Reconciliation Start)'::"text" AS "item",
    "sum"(
        CASE
            WHEN ("v_all_transactions_classified"."usage" = ANY (ARRAY['sale_profit'::"text", 'staking_rewards'::"text", 'payment_in_crypto'::"text"])) THEN "v_all_transactions_classified"."value_usd"
            ELSE (- "v_all_transactions_classified"."value_usd")
        END) AS "amount",
    "sum"(
        CASE
            WHEN ("v_all_transactions_classified"."usage" = ANY (ARRAY['sale_profit'::"text", 'staking_rewards'::"text", 'payment_in_crypto'::"text"])) THEN "v_all_transactions_classified"."value_usd"
            ELSE (- "v_all_transactions_classified"."value_usd")
        END) AS "amount_usd",
    "sum"(
        CASE
            WHEN ("v_all_transactions_classified"."usage" = ANY (ARRAY['sale_profit'::"text", 'staking_rewards'::"text", 'payment_in_crypto'::"text"])) THEN "v_all_transactions_classified"."value_jpy"
            ELSE (- "v_all_transactions_classified"."value_jpy")
        END) AS "amount_jpy",
    "sum"(
        CASE
            WHEN ("v_all_transactions_classified"."usage" = ANY (ARRAY['sale_profit'::"text", 'staking_rewards'::"text", 'payment_in_crypto'::"text"])) THEN "v_all_transactions_classified"."value_eur"
            ELSE (- "v_all_transactions_classified"."value_eur")
        END) AS "amount_eur"
   FROM "public"."v_all_transactions_classified"
  WHERE (("v_all_transactions_classified"."usage" IS NOT NULL) AND ("v_all_transactions_classified"."usage" <> 'cash_purchase'::"text") AND ("v_all_transactions_classified"."transaction_type" <> 'INTERNAL_TRANSFER'::"text"))
  GROUP BY "v_all_transactions_classified"."user_id", "v_all_transactions_classified"."entity_id", "v_all_transactions_classified"."entity_name"
UNION ALL
 SELECT "v_all_transactions_classified"."user_id",
    "v_all_transactions_classified"."entity_id",
    "v_all_transactions_classified"."entity_name" AS "entity",
    "v_all_transactions_classified"."date",
        CASE
            WHEN ("v_all_transactions_classified"."usage" = 'fair_value_gain'::"text") THEN 'Adj: Fair Value Gain'::"text"
            WHEN ("v_all_transactions_classified"."usage" = 'fair_value_loss'::"text") THEN 'Adj: Fair Value Loss'::"text"
            WHEN ("v_all_transactions_classified"."usage" = 'impairment_loss'::"text") THEN 'Adj: Impairment Loss'::"text"
            WHEN ("v_all_transactions_classified"."usage" = 'sale_profit'::"text") THEN 'Adj: Sale Profit'::"text"
            WHEN ("v_all_transactions_classified"."usage" = 'sale_loss'::"text") THEN 'Adj: Sale Loss'::"text"
            WHEN ("v_all_transactions_classified"."usage" = 'staking_rewards'::"text") THEN 'Adj: Non-cash Rewards'::"text"
            WHEN ("v_all_transactions_classified"."usage" = 'payment_in_crypto'::"text") THEN 'Adj: Deemed Sale Gain'::"text"
            ELSE "v_all_transactions_classified"."usage"
        END AS "item",
        CASE
            WHEN ("v_all_transactions_classified"."usage" = ANY (ARRAY['fair_value_gain'::"text", 'sale_profit'::"text", 'staking_rewards'::"text", 'payment_in_crypto'::"text"])) THEN (- "v_all_transactions_classified"."value_usd")
            ELSE "v_all_transactions_classified"."value_usd"
        END AS "amount",
        CASE
            WHEN ("v_all_transactions_classified"."usage" = ANY (ARRAY['fair_value_gain'::"text", 'sale_profit'::"text", 'staking_rewards'::"text", 'payment_in_crypto'::"text"])) THEN (- "v_all_transactions_classified"."value_usd")
            ELSE "v_all_transactions_classified"."value_usd"
        END AS "amount_usd",
        CASE
            WHEN ("v_all_transactions_classified"."usage" = ANY (ARRAY['fair_value_gain'::"text", 'sale_profit'::"text", 'staking_rewards'::"text", 'payment_in_crypto'::"text"])) THEN (- "v_all_transactions_classified"."value_jpy")
            ELSE "v_all_transactions_classified"."value_jpy"
        END AS "amount_jpy",
        CASE
            WHEN ("v_all_transactions_classified"."usage" = ANY (ARRAY['fair_value_gain'::"text", 'sale_profit'::"text", 'staking_rewards'::"text", 'payment_in_crypto'::"text"])) THEN (- "v_all_transactions_classified"."value_eur")
            ELSE "v_all_transactions_classified"."value_eur"
        END AS "amount_eur"
   FROM "public"."v_all_transactions_classified"
  WHERE ("v_all_transactions_classified"."usage" = ANY (ARRAY['fair_value_gain'::"text", 'fair_value_loss'::"text", 'impairment_loss'::"text", 'sale_profit'::"text", 'sale_loss'::"text", 'staking_rewards'::"text", 'payment_in_crypto'::"text"]))
UNION ALL
 SELECT "v_all_transactions_classified"."user_id",
    "v_all_transactions_classified"."entity_id",
    "v_all_transactions_classified"."entity_name" AS "entity",
    "v_all_transactions_classified"."date",
    'Acquisition of Crypto Assets'::"text" AS "item",
    (- "v_all_transactions_classified"."value_usd") AS "amount",
    (- "v_all_transactions_classified"."value_usd") AS "amount_usd",
    (- "v_all_transactions_classified"."value_jpy") AS "amount_jpy",
    (- "v_all_transactions_classified"."value_eur") AS "amount_eur"
   FROM "public"."v_all_transactions_classified"
  WHERE ("v_all_transactions_classified"."usage" = 'cash_purchase'::"text")
UNION ALL
 SELECT "v_all_transactions_classified"."user_id",
    "v_all_transactions_classified"."entity_id",
    "v_all_transactions_classified"."entity_name" AS "entity",
    "v_all_transactions_classified"."date",
    'Proceeds from Sale of Crypto Assets'::"text" AS "item",
    "v_all_transactions_classified"."value_usd" AS "amount",
    "v_all_transactions_classified"."value_usd" AS "amount_usd",
    "v_all_transactions_classified"."value_jpy" AS "amount_jpy",
    "v_all_transactions_classified"."value_eur" AS "amount_eur"
   FROM "public"."v_all_transactions_classified"
  WHERE ("v_all_transactions_classified"."usage" = ANY (ARRAY['sale_profit'::"text", 'sale_loss'::"text"]));


ALTER VIEW "public"."v_cash_flow_statement" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_profit_loss_statement" AS
 SELECT "user_id",
    "entity_id",
    "entity_name" AS "entity",
    "date",
        CASE
            WHEN ("usage" = 'staking_rewards'::"text") THEN 'Other Revenue / Sales'::"text"
            WHEN ("usage" = 'sale_profit'::"text") THEN 'Realized Gain (Non-operating)'::"text"
            WHEN ("usage" = 'sale_loss'::"text") THEN 'Realized Loss (Non-operating)'::"text"
            WHEN ("usage" = 'fair_value_gain'::"text") THEN 'Fair Value Gain (Non-operating)'::"text"
            WHEN ("usage" = 'fair_value_loss'::"text") THEN 'Fair Value Loss (Non-operating)'::"text"
            WHEN ("usage" = 'impairment_loss'::"text") THEN 'Impairment Loss (Extraordinary)'::"text"
            WHEN ("usage" = 'payment_in_crypto'::"text") THEN 'Realized Gain (Deemed)'::"text"
            ELSE "usage"
        END AS "account",
    "value_usd" AS "balance",
    "value_usd" AS "balance_usd",
    "value_jpy" AS "balance_jpy",
    "value_eur" AS "balance_eur"
   FROM "public"."v_all_transactions_classified"
  WHERE (("usage" IS NOT NULL) AND ("usage" <> 'cash_purchase'::"text") AND ("transaction_type" <> 'INTERNAL_TRANSFER'::"text"));


ALTER VIEW "public"."v_profit_loss_statement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_nonces" (
    "user_id" "uuid" NOT NULL,
    "nonce" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wallet_nonces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_sync_state" (
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "chain_id" bigint DEFAULT 1 NOT NULL,
    "last_block" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wallet_sync_state" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wallet_transaction" AS
 SELECT "id",
    "user_id",
    "wallet_address",
    "chain_id",
    "direction",
    "tx_hash",
    "block_number",
    "timestamp",
    "from_address",
    "to_address",
    "value_wei",
    "asset_symbol",
    "raw",
    "created_at",
    "asset_decimals",
    "price_usd",
    "fiat_value_usd",
    "occurred_at"
   FROM "public"."wallet_transactions";


ALTER VIEW "public"."wallet_transaction" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."wallet_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wallet_transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wallet_transactions_id_seq" OWNED BY "public"."wallet_transactions"."id";



CREATE OR REPLACE VIEW "public"."wallet_tx_with_flags" AS
 SELECT "id",
    "user_id",
    "wallet_address",
    "chain_id",
    "direction",
    "tx_hash",
    "block_number",
    "timestamp",
    "from_address",
    "to_address",
    "value_wei",
    "asset_symbol",
    "raw",
    "created_at",
    "asset_decimals",
    "price_usd",
    "fiat_value_usd",
    "occurred_at",
    (EXISTS ( SELECT 1
           FROM "public"."internal_transfer_links" "l"
          WHERE (("l"."out_tx_id" = "t"."id") OR ("l"."in_tx_id" = "t"."id")))) AS "is_internal_transfer"
   FROM "public"."wallet_transactions" "t";


ALTER VIEW "public"."wallet_tx_with_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "address" "text" NOT NULL,
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


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
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crypto_payments"
    ADD CONSTRAINT "crypto_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_exchange_rates"
    ADD CONSTRAINT "daily_exchange_rates_pkey" PRIMARY KEY ("date", "source_currency", "target_currency");



ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_accounts"
    ADD CONSTRAINT "exchange_accounts_connection_id_account_uid_key" UNIQUE ("connection_id", "account_uid");



ALTER TABLE ONLY "public"."exchange_accounts"
    ADD CONSTRAINT "exchange_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_api_credentials"
    ADD CONSTRAINT "exchange_api_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_api_credentials"
    ADD CONSTRAINT "exchange_api_credentials_user_id_exchange_key" UNIQUE ("user_id", "exchange");



ALTER TABLE ONLY "public"."exchange_balances"
    ADD CONSTRAINT "exchange_balances_account_id_asset_at_key" UNIQUE ("account_id", "asset", "at");



ALTER TABLE ONLY "public"."exchange_balances"
    ADD CONSTRAINT "exchange_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_connections"
    ADD CONSTRAINT "exchange_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_trade_values"
    ADD CONSTRAINT "exchange_trade_values_pkey" PRIMARY KEY ("exchange_trade_id");



ALTER TABLE ONLY "public"."exchange_trades"
    ADD CONSTRAINT "exchange_trades_exchange_external_id_key" UNIQUE ("exchange", "external_id");



ALTER TABLE ONLY "public"."exchange_trades"
    ADD CONSTRAINT "exchange_trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_trades"
    ADD CONSTRAINT "exchange_trades_user_id_exchange_trade_id_key" UNIQUE ("user_id", "exchange", "trade_id");



ALTER TABLE ONLY "public"."exchange_trades"
    ADD CONSTRAINT "exchange_trades_user_id_trade_id_key" UNIQUE ("user_id", "trade_id");



ALTER TABLE ONLY "public"."exchange_transfers"
    ADD CONSTRAINT "exchange_transfers_account_id_txid_direction_key" UNIQUE ("account_id", "txid", "direction");



ALTER TABLE ONLY "public"."exchange_transfers"
    ADD CONSTRAINT "exchange_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_transfer_links"
    ADD CONSTRAINT "internal_transfer_links_out_tx_id_in_tx_id_key" UNIQUE ("out_tx_id", "in_tx_id");



ALTER TABLE ONLY "public"."internal_transfer_links"
    ADD CONSTRAINT "internal_transfer_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meter_events"
    ADD CONSTRAINT "meter_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nonce_store"
    ADD CONSTRAINT "nonce_store_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_merchants"
    ADD CONSTRAINT "payment_merchants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_vault_addresses"
    ADD CONSTRAINT "payment_vault_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_vault_addresses"
    ADD CONSTRAINT "payment_vault_addresses_user_id_network_asset_key" UNIQUE ("user_id", "network", "asset");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."transaction_purposes"
    ADD CONSTRAINT "transaction_purposes_pkey" PRIMARY KEY ("user_id", "source", "source_id");



ALTER TABLE ONLY "public"."transaction_usage_labels"
    ADD CONSTRAINT "transaction_usage_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_usage_labels"
    ADD CONSTRAINT "transaction_usage_labels_unique_ctx" UNIQUE ("user_id", "ctx_id");



ALTER TABLE ONLY "public"."transaction_usage_labels"
    ADD CONSTRAINT "transaction_usage_labels_unique_tx" UNIQUE ("user_id", "tx_id");



ALTER TABLE ONLY "public"."transaction_usage_predictions"
    ADD CONSTRAINT "transaction_usage_predictions_pkey" PRIMARY KEY ("user_id", "tx_id", "model");



ALTER TABLE ONLY "public"."transaction_usages"
    ADD CONSTRAINT "transaction_usages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_usages"
    ADD CONSTRAINT "transaction_usages_user_id_source_type_source_id_key" UNIQUE ("user_id", "source_type", "source_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_transaction_hash_key" UNIQUE ("transaction_hash");



ALTER TABLE ONLY "public"."transfer_links"
    ADD CONSTRAINT "transfer_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfer_links"
    ADD CONSTRAINT "transfer_links_wallet_tx_id_exchange_transfer_id_key" UNIQUE ("wallet_tx_id", "exchange_transfer_id");



ALTER TABLE ONLY "public"."transfers"
    ADD CONSTRAINT "transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_connections"
    ADD CONSTRAINT "unique_user_connection_name" UNIQUE ("user_id", "connection_name");



ALTER TABLE ONLY "public"."usage_categories"
    ADD CONSTRAINT "usage_categories_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."user_monthly_counters"
    ADD CONSTRAINT "user_monthly_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_monthly_counters"
    ADD CONSTRAINT "user_monthly_counters_user_id_month_year_key" UNIQUE ("user_id", "month_year");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_connections"
    ADD CONSTRAINT "wallet_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_connections"
    ADD CONSTRAINT "wallet_connections_user_id_wallet_address_key" UNIQUE ("user_id", "wallet_address");



ALTER TABLE ONLY "public"."wallet_nonces"
    ADD CONSTRAINT "wallet_nonces_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wallet_sync_state"
    ADD CONSTRAINT "wallet_sync_state_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_composite_key" UNIQUE ("tx_hash", "user_id", "chain");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_address_unique" UNIQUE ("user_id", "address");



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



CREATE OR REPLACE TRIGGER "clear_profile_fields_trigger" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."clear_unused_profile_fields"();



CREATE OR REPLACE TRIGGER "profiles_mirror_id_user_id" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."fn_profiles_mirror_id_user_id"();



CREATE OR REPLACE TRIGGER "tr_invoices_set_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."tg_invoices_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_align_ids" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_align_ids"();



CREATE OR REPLACE TRIGGER "trigger_calculate_wallet_tx_usd" BEFORE INSERT OR UPDATE ON "public"."wallet_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_wallet_tx_usd_value"();



CREATE OR REPLACE TRIGGER "update_crypto_payments_updated_at" BEFORE UPDATE ON "public"."crypto_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_transactions_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_monthly_counters_updated_at" BEFORE UPDATE ON "public"."user_monthly_counters" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_wallet_connections_updated_at" BEFORE UPDATE ON "public"."wallet_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crypto_payments"
    ADD CONSTRAINT "crypto_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_accounts"
    ADD CONSTRAINT "exchange_accounts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."exchange_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_api_credentials"
    ADD CONSTRAINT "exchange_api_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_balances"
    ADD CONSTRAINT "exchange_balances_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."exchange_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_connections"
    ADD CONSTRAINT "exchange_connections_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exchange_connections"
    ADD CONSTRAINT "exchange_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_trades"
    ADD CONSTRAINT "exchange_trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exchange_transfers"
    ADD CONSTRAINT "exchange_transfers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."exchange_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_trades"
    ADD CONSTRAINT "fk_exchange_connections" FOREIGN KEY ("exchange_connection_id") REFERENCES "public"."exchange_connections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_tx_id_fkey" FOREIGN KEY ("tx_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nonce_store"
    ADD CONSTRAINT "nonce_store_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_merchants"
    ADD CONSTRAINT "payment_merchants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_vault_addresses"
    ADD CONSTRAINT "payment_vault_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_usage_predictions"
    ADD CONSTRAINT "transaction_usage_predictions_tx_id_fkey" FOREIGN KEY ("tx_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_usages"
    ADD CONSTRAINT "transaction_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transfers"
    ADD CONSTRAINT "transfers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."transfers"
    ADD CONSTRAINT "transfers_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."transfers"
    ADD CONSTRAINT "transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."wallet_connections"
    ADD CONSTRAINT "wallet_connections_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_connections"
    ADD CONSTRAINT "wallet_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



CREATE POLICY "Insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Read access for all users" ON "public"."asset_prices" FOR SELECT USING (true);



CREATE POLICY "Update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own crypto payments" ON "public"."crypto_payments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own transactions" ON "public"."transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own wallet connections" ON "public"."wallet_connections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own entities" ON "public"."entities" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own wallet connections" ON "public"."wallet_connections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own entities" ON "public"."entities" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



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



CREATE POLICY "allow_upsert_own_profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "allow_user_manage_clients" ON "public"."clients" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "allow_user_manage_companies" ON "public"."companies" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "allow_user_manage_exchange_trade_values" ON "public"."exchange_trade_values" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "allow_user_manage_transfers" ON "public"."transfers" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "allow_user_modify_customers" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "allow_user_modify_invoices" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "allow_user_modify_wallets" ON "public"."wallet_connections" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



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



CREATE POLICY "auth_insert_customers" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_invoices" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "auth_insert_usage_labels" ON "public"."transaction_usage_labels" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_insert_wallet_tx" ON "public"."wallet_transactions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_insert_wallets" ON "public"."wallet_connections" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



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


CREATE POLICY "clients_ins_own" ON "public"."clients" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "clients_select_own" ON "public"."clients" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "clients_upd_own" ON "public"."clients" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_ins_own" ON "public"."companies" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "companies_select_own" ON "public"."companies" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "companies_upd_own" ON "public"."companies" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "cred_delete_own" ON "public"."exchange_api_credentials" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cred_select_own" ON "public"."exchange_api_credentials" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cred_upsert_own" ON "public"."exchange_api_credentials" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."crypto_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_ins_own" ON "public"."customers" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



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



CREATE POLICY "invoices_ins_own" ON "public"."invoices" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "invoices_insert_own" ON "public"."invoices" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "invoices_select_own" ON "public"."invoices" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "invoices_upd_own" ON "public"."invoices" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "invoices_update_own" ON "public"."invoices" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "je_delete_own" ON "public"."journal_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "je_ins_owner" ON "public"."journal_entries" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "je_insert_own" ON "public"."journal_entries" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "je_select_own" ON "public"."journal_entries" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "je_select_owner" ON "public"."journal_entries" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "je_self_all" ON "public"."journal_entries" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "je_upd_owner" ON "public"."journal_entries" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "je_update_own" ON "public"."journal_entries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "jl_ins_owner" ON "public"."journal_lines" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."journal_entries" "je"
  WHERE (("je"."id" = "journal_lines"."entry_id") AND ("je"."user_id" = "auth"."uid"())))));



CREATE POLICY "jl_select_owner" ON "public"."journal_lines" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."journal_entries" "je"
  WHERE (("je"."id" = "journal_lines"."entry_id") AND ("je"."user_id" = "auth"."uid"())))));



CREATE POLICY "jl_upd_owner" ON "public"."journal_lines" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."journal_entries" "je"
  WHERE (("je"."id" = "journal_lines"."entry_id") AND ("je"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."journal_entries" "je"
  WHERE (("je"."id" = "journal_lines"."entry_id") AND ("je"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "labels_delete_own" ON "public"."transaction_usage_labels" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "labels_select_own" ON "public"."transaction_usage_labels" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "labels_update_own" ON "public"."transaction_usage_labels" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "labels_upsert_own" ON "public"."transaction_usage_labels" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."meter_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nonce_store" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_merchants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_vault_addresses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pl_ins_own" ON "public"."payment_links" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "pl_select_own" ON "public"."payment_links" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "pm_select_own" ON "public"."payment_merchants" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "pm_upsert_own" ON "public"."payment_merchants" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "pred_select_own" ON "public"."transaction_usage_predictions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "pred_update_own" ON "public"."transaction_usage_predictions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "pred_upsert_own" ON "public"."transaction_usage_predictions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_self_only" ON "public"."profiles" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



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



CREATE POLICY "tx_insert_self" ON "public"."wallet_transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "tx_select_self" ON "public"."wallet_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "tx_update_self" ON "public"."wallet_transactions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "tx_usage_del_owner" ON "public"."transaction_usage_labels" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tx_usage_ins_owner" ON "public"."transaction_usage_labels" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "tx_usage_select_owner" ON "public"."transaction_usage_labels" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tx_usage_upd_owner" ON "public"."transaction_usage_labels" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_monthly_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vault_ins_own" ON "public"."payment_vault_addresses" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "vault_select_own" ON "public"."payment_vault_addresses" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "vault_upd_own" ON "public"."payment_vault_addresses" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "vce_delete_own" ON "public"."exchange_connections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "vce_insert_own" ON "public"."exchange_connections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "vce_select_own" ON "public"."exchange_connections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "vce_update_own" ON "public"."exchange_connections" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."wallet_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_nonces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_sync_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallets select own" ON "public"."wallets" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets update own" ON "public"."wallets" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets upsert own" ON "public"."wallets" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_del_own" ON "public"."wallets" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_delete_own" ON "public"."wallets" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_delete_self" ON "public"."wallets" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "wallets_ins" ON "public"."wallets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_ins_own" ON "public"."wallets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_insert_own" ON "public"."wallets" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_insert_self" ON "public"."wallets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "wallets_sel" ON "public"."wallets" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_select_own" ON "public"."wallets" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_select_self" ON "public"."wallets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "wallets_upd" ON "public"."wallets" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_upd_own" ON "public"."wallets" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_update_own" ON "public"."wallets" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_update_self" ON "public"."wallets" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "wt_insert_own" ON "public"."wallet_transactions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "wt_select_own" ON "public"."wallet_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wtx_delete_own" ON "public"."wallet_transactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "wtx_insert_own" ON "public"."wallet_transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "wtx_select_own" ON "public"."wallet_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "wtx_update_own" ON "public"."wallet_transactions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



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







