create extension if not exists "pg_cron" with schema "pg_catalog";

create type "public"."us_entity_type_enum" as enum ('C Corporation', 'S Corporation', 'LLC', 'Partnership', 'PC/PA', 'PBC');

create type "public"."us_state_of_incorporation_enum" as enum ('Alabama', 'Alaska', 'Arizona', 'Wyoming', 'District of Columbia');

create sequence "public"."exchange_api_credentials_id_seq";

create sequence "public"."internal_transfer_links_id_seq";

create sequence "public"."journal_entries_id_seq";

create sequence "public"."journal_lines_id_seq";

alter table "public"."journal_entries" drop constraint "journal_entries_usage_key_fkey";

alter table "public"."transaction_usage_labels" drop constraint "transaction_usage_labels_predicted_key_fkey";

alter table "public"."transaction_usage_labels" drop constraint "transaction_usage_labels_tx_id_fkey";

alter table "public"."transaction_usage_labels" drop constraint "transaction_usage_labels_usage_key_fkey";

alter table "public"."clients" drop constraint "clients_user_id_fkey";

alter table "public"."companies" drop constraint "companies_user_id_fkey";

alter table "public"."exchange_trades" drop constraint "exchange_trades_user_id_fkey";

alter table "public"."transfers" drop constraint "transfers_client_id_fkey";

alter table "public"."transfers" drop constraint "transfers_invoice_id_fkey";

alter table "public"."transfers" drop constraint "transfers_user_id_fkey";

drop view if exists "public"."v_balance_sheet";

drop view if exists "public"."v_cash_flow_statement";

drop view if exists "public"."v_holdings";

drop view if exists "public"."v_profit_loss_statement";

drop view if exists "public"."v_all_transactions_classified";

drop view if exists "public"."internal_transfer_pairs";

drop view if exists "public"."all_transactions";


  create table "public"."exchange_accounts" (
    "id" bigint generated always as identity not null,
    "connection_id" bigint,
    "account_uid" text not null,
    "type" text
      );



  create table "public"."exchange_api_credentials" (
    "id" bigint not null default nextval('public.exchange_api_credentials_id_seq'::regclass),
    "user_id" uuid not null,
    "exchange" text not null,
    "external_user_id" text,
    "enc_blob" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."exchange_api_credentials" enable row level security;


  create table "public"."exchange_balances" (
    "id" bigint generated always as identity not null,
    "account_id" bigint,
    "asset" text not null,
    "free" numeric,
    "locked" numeric,
    "total" numeric,
    "at" timestamp with time zone not null
      );



  create table "public"."exchange_trade_values" (
    "exchange_trade_id" text not null,
    "user_id" uuid not null,
    "asset" text,
    "symbol" text,
    "base_amount" numeric,
    "price_usd" numeric,
    "fiat_value_usd" numeric,
    "fee" numeric,
    "fee_asset" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."exchange_trade_values" enable row level security;


  create table "public"."exchange_transfers" (
    "id" bigint generated always as identity not null,
    "account_id" bigint,
    "direction" text,
    "asset" text not null,
    "amount" numeric not null,
    "txid" text,
    "network" text,
    "occurred_at" timestamp with time zone not null,
    "raw" jsonb
      );



  create table "public"."internal_transfer_links" (
    "id" bigint not null default nextval('public.internal_transfer_links_id_seq'::regclass),
    "out_tx_id" bigint not null,
    "in_tx_id" bigint not null,
    "reason" text not null,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."payment_links" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "title" text,
    "amount" numeric,
    "currency" text,
    "status" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."payment_links" enable row level security;


  create table "public"."payment_merchants" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "store_name" text,
    "default_currency" text,
    "allowed_networks" text[],
    "webhook_secret" text,
    "webhook_url" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."payment_merchants" enable row level security;


  create table "public"."transaction_purposes" (
    "user_id" uuid not null,
    "source" text not null,
    "source_id" text not null,
    "purpose" text not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."transaction_purposes" enable row level security;


  create table "public"."transaction_usages" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "source_type" text,
    "source_id" text not null,
    "usage_predicted" text,
    "usage_manual" text,
    "confidence" numeric,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."transfer_links" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "wallet_tx_id" bigint not null,
    "exchange_transfer_id" bigint not null,
    "confidence" real not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."wallet_nonces" (
    "user_id" uuid not null,
    "nonce" text not null,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."wallet_nonces" enable row level security;


  create table "public"."wallets" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "address" text not null,
    "verified" boolean default false,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."wallets" enable row level security;

alter table "public"."exchange_connections" alter column "id" drop default;

alter table "public"."exchange_connections" alter column "id" add generated always as identity;

alter table "public"."exchange_connections" alter column "status" set default 'linked'::text;

alter table "public"."exchange_trades" alter column "fee_currency" set data type text using "fee_currency"::text;

alter table "public"."exchange_trades" alter column "id" set default gen_random_uuid();

alter table "public"."exchange_trades" alter column "id" drop identity;

alter table "public"."exchange_trades" alter column "id" set data type uuid using "id"::uuid;

alter table "public"."invoices" add column "billing_address" text;

alter table "public"."invoices" add column "company_address" text;

alter table "public"."invoices" add column "company_wallet_address" text;

alter table "public"."invoices" add column "issue_date" date default CURRENT_DATE;

alter table "public"."invoices" add column "items" jsonb;

alter table "public"."invoices" add column "notes" text;

alter table "public"."invoices" add column "number" text;

alter table "public"."invoices" add column "subtotal" numeric;

alter table "public"."invoices" add column "tax" numeric;

alter table "public"."invoices" add column "tax_rate" numeric(5,2);

alter table "public"."invoices" add column "total" numeric;

alter table "public"."journal_entries" drop column "created_at";

alter table "public"."journal_entries" drop column "source";

alter table "public"."journal_entries" drop column "usage_key";

alter table "public"."journal_entries" add column "account" text not null;

alter table "public"."journal_entries" add column "amount" numeric(78,18) not null;

alter table "public"."journal_entries" add column "currency" text not null default 'USD'::text;

alter table "public"."journal_entries" add column "dc" character(1) not null;

alter table "public"."journal_entries" alter column "entry_date" set data type date using "entry_date"::date;

alter table "public"."journal_entries" alter column "id" set default nextval('public.journal_entries_id_seq'::regclass);

alter table "public"."journal_entries" alter column "id" set data type bigint using "id"::bigint;

alter table "public"."journal_lines" alter column "entry_id" set data type bigint using "entry_id"::bigint;

alter table "public"."journal_lines" alter column "id" set default nextval('public.journal_lines_id_seq'::regclass);

alter table "public"."journal_lines" alter column "id" set data type bigint using "id"::bigint;

alter table "public"."profiles" add column "gateway_enabled" boolean default false;

alter table "public"."profiles" add column "income_bracket" text;

alter table "public"."profiles" add column "region" text;

alter table "public"."transaction_usage_labels" drop column "created_at";

alter table "public"."transaction_usage_labels" drop column "notes";

alter table "public"."transaction_usage_labels" drop column "predicted_key";

alter table "public"."transaction_usage_labels" alter column "updated_at" drop not null;

alter table "public"."transfers" drop column "tx_hash";

alter table "public"."transfers" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."transfers" alter column "user_id" drop not null;

alter table "public"."wallet_connections" alter column "chain" drop default;

alter table "public"."wallet_transactions" alter column "asset_decimals" set default 18;

alter table "public"."wallet_transactions" alter column "asset_decimals" set data type smallint using "asset_decimals"::smallint;

alter sequence "public"."exchange_api_credentials_id_seq" owned by "public"."exchange_api_credentials"."id";

alter sequence "public"."internal_transfer_links_id_seq" owned by "public"."internal_transfer_links"."id";

alter sequence "public"."journal_entries_id_seq" owned by "public"."journal_entries"."id";

alter sequence "public"."journal_lines_id_seq" owned by "public"."journal_lines"."id";

drop sequence if exists "public"."exchange_connections_id_seq";

CREATE INDEX clients_user_idx ON public.clients USING btree (user_id);

CREATE INDEX companies_user_idx ON public.companies USING btree (user_id);

CREATE INDEX customers_user_id_idx ON public.customers USING btree (user_id);

CREATE UNIQUE INDEX exchange_accounts_connection_id_account_uid_key ON public.exchange_accounts USING btree (connection_id, account_uid);

CREATE UNIQUE INDEX exchange_accounts_pkey ON public.exchange_accounts USING btree (id);

CREATE INDEX exchange_api_credentials_exchange_idx ON public.exchange_api_credentials USING btree (exchange);

CREATE UNIQUE INDEX exchange_api_credentials_pkey ON public.exchange_api_credentials USING btree (id);

CREATE UNIQUE INDEX exchange_api_credentials_user_id_exchange_key ON public.exchange_api_credentials USING btree (user_id, exchange);

CREATE INDEX exchange_api_credentials_user_idx ON public.exchange_api_credentials USING btree (user_id);

CREATE UNIQUE INDEX exchange_balances_account_id_asset_at_key ON public.exchange_balances USING btree (account_id, asset, at);

CREATE UNIQUE INDEX exchange_balances_pkey ON public.exchange_balances USING btree (id);

CREATE INDEX exchange_connections_exchange_idx ON public.exchange_connections USING btree (exchange);

CREATE INDEX exchange_connections_user_id_idx ON public.exchange_connections USING btree (user_id);

CREATE UNIQUE INDEX exchange_trade_values_pkey ON public.exchange_trade_values USING btree (exchange_trade_id);

CREATE UNIQUE INDEX exchange_trades_exchange_external_id_key ON public.exchange_trades USING btree (exchange, external_id);

CREATE UNIQUE INDEX exchange_trades_user_id_trade_id_key ON public.exchange_trades USING btree (user_id, trade_id);

CREATE UNIQUE INDEX exchange_transfers_account_id_txid_direction_key ON public.exchange_transfers USING btree (account_id, txid, direction);

CREATE UNIQUE INDEX exchange_transfers_pkey ON public.exchange_transfers USING btree (id);

CREATE INDEX idx_transaction_usage_labels_user_ctx ON public.transaction_usage_labels USING btree (user_id, ctx_id);

CREATE INDEX idx_transaction_usage_labels_user_tx ON public.transaction_usage_labels USING btree (user_id, tx_id);

CREATE UNIQUE INDEX internal_transfer_links_out_tx_id_in_tx_id_key ON public.internal_transfer_links USING btree (out_tx_id, in_tx_id);

CREATE UNIQUE INDEX internal_transfer_links_pkey ON public.internal_transfer_links USING btree (id);

CREATE INDEX invoices_client_id_idx ON public.invoices USING btree (client_id);

CREATE INDEX invoices_company_id_idx ON public.invoices USING btree (company_id);

CREATE INDEX invoices_issue_date_idx ON public.invoices USING btree (issue_date);

CREATE INDEX invoices_user_id_idx ON public.invoices USING btree (user_id);

CREATE INDEX invoices_user_idx ON public.invoices USING btree (user_id);

CREATE INDEX itl_in_idx ON public.internal_transfer_links USING btree (in_tx_id);

CREATE INDEX itl_out_idx ON public.internal_transfer_links USING btree (out_tx_id);

CREATE UNIQUE INDEX payment_links_pkey ON public.payment_links USING btree (id);

CREATE UNIQUE INDEX payment_merchants_pkey ON public.payment_merchants USING btree (id);

CREATE UNIQUE INDEX payment_merchants_user_id_key ON public.payment_merchants USING btree (user_id);

CREATE UNIQUE INDEX transaction_purposes_pkey ON public.transaction_purposes USING btree (user_id, source, source_id);

CREATE UNIQUE INDEX transaction_usage_labels_user_ctx_key ON public.transaction_usage_labels USING btree (user_id, ctx_id) WHERE (ctx_id IS NOT NULL);

CREATE UNIQUE INDEX transaction_usage_labels_user_tx_key ON public.transaction_usage_labels USING btree (user_id, tx_id) WHERE (tx_id IS NOT NULL);

CREATE UNIQUE INDEX transaction_usages_pkey ON public.transaction_usages USING btree (id);

CREATE UNIQUE INDEX transaction_usages_user_id_source_type_source_id_key ON public.transaction_usages USING btree (user_id, source_type, source_id);

CREATE UNIQUE INDEX transfer_links_pkey ON public.transfer_links USING btree (id);

CREATE UNIQUE INDEX transfer_links_wallet_tx_id_exchange_transfer_id_key ON public.transfer_links USING btree (wallet_tx_id, exchange_transfer_id);

CREATE UNIQUE INDEX wallet_nonces_pkey ON public.wallet_nonces USING btree (user_id);

CREATE UNIQUE INDEX wallet_tx_user_hash_uidx ON public.wallet_transactions USING btree (user_id, tx_hash);

CREATE UNIQUE INDEX wallets_pkey ON public.wallets USING btree (id);

CREATE UNIQUE INDEX wallets_user_addr_uniq ON public.wallets USING btree (user_id, lower(address));

CREATE UNIQUE INDEX wallets_user_address_unique ON public.wallets USING btree (user_id, address);

alter table "public"."exchange_accounts" add constraint "exchange_accounts_pkey" PRIMARY KEY using index "exchange_accounts_pkey";

alter table "public"."exchange_api_credentials" add constraint "exchange_api_credentials_pkey" PRIMARY KEY using index "exchange_api_credentials_pkey";

alter table "public"."exchange_balances" add constraint "exchange_balances_pkey" PRIMARY KEY using index "exchange_balances_pkey";

alter table "public"."exchange_trade_values" add constraint "exchange_trade_values_pkey" PRIMARY KEY using index "exchange_trade_values_pkey";

alter table "public"."exchange_transfers" add constraint "exchange_transfers_pkey" PRIMARY KEY using index "exchange_transfers_pkey";

alter table "public"."internal_transfer_links" add constraint "internal_transfer_links_pkey" PRIMARY KEY using index "internal_transfer_links_pkey";

alter table "public"."payment_links" add constraint "payment_links_pkey" PRIMARY KEY using index "payment_links_pkey";

alter table "public"."payment_merchants" add constraint "payment_merchants_pkey" PRIMARY KEY using index "payment_merchants_pkey";

alter table "public"."transaction_purposes" add constraint "transaction_purposes_pkey" PRIMARY KEY using index "transaction_purposes_pkey";

alter table "public"."transaction_usages" add constraint "transaction_usages_pkey" PRIMARY KEY using index "transaction_usages_pkey";

alter table "public"."transfer_links" add constraint "transfer_links_pkey" PRIMARY KEY using index "transfer_links_pkey";

alter table "public"."wallet_nonces" add constraint "wallet_nonces_pkey" PRIMARY KEY using index "wallet_nonces_pkey";

alter table "public"."wallets" add constraint "wallets_pkey" PRIMARY KEY using index "wallets_pkey";

alter table "public"."exchange_accounts" add constraint "exchange_accounts_connection_id_account_uid_key" UNIQUE using index "exchange_accounts_connection_id_account_uid_key";

alter table "public"."exchange_accounts" add constraint "exchange_accounts_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES public.exchange_connections(id) ON DELETE CASCADE not valid;

alter table "public"."exchange_accounts" validate constraint "exchange_accounts_connection_id_fkey";

alter table "public"."exchange_api_credentials" add constraint "exchange_api_credentials_exchange_check" CHECK ((exchange = ANY (ARRAY['binance'::text, 'bybit'::text, 'okx'::text]))) not valid;

alter table "public"."exchange_api_credentials" validate constraint "exchange_api_credentials_exchange_check";

alter table "public"."exchange_api_credentials" add constraint "exchange_api_credentials_user_id_exchange_key" UNIQUE using index "exchange_api_credentials_user_id_exchange_key";

alter table "public"."exchange_api_credentials" add constraint "exchange_api_credentials_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."exchange_api_credentials" validate constraint "exchange_api_credentials_user_id_fkey";

alter table "public"."exchange_balances" add constraint "exchange_balances_account_id_asset_at_key" UNIQUE using index "exchange_balances_account_id_asset_at_key";

alter table "public"."exchange_balances" add constraint "exchange_balances_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.exchange_accounts(id) ON DELETE CASCADE not valid;

alter table "public"."exchange_balances" validate constraint "exchange_balances_account_id_fkey";

alter table "public"."exchange_trades" add constraint "exchange_trades_exchange_external_id_key" UNIQUE using index "exchange_trades_exchange_external_id_key";

alter table "public"."exchange_trades" add constraint "exchange_trades_user_id_trade_id_key" UNIQUE using index "exchange_trades_user_id_trade_id_key";

alter table "public"."exchange_transfers" add constraint "exchange_transfers_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.exchange_accounts(id) ON DELETE CASCADE not valid;

alter table "public"."exchange_transfers" validate constraint "exchange_transfers_account_id_fkey";

alter table "public"."exchange_transfers" add constraint "exchange_transfers_account_id_txid_direction_key" UNIQUE using index "exchange_transfers_account_id_txid_direction_key";

alter table "public"."exchange_transfers" add constraint "exchange_transfers_direction_check" CHECK ((direction = ANY (ARRAY['deposit'::text, 'withdraw'::text]))) not valid;

alter table "public"."exchange_transfers" validate constraint "exchange_transfers_direction_check";

alter table "public"."internal_transfer_links" add constraint "internal_transfer_links_out_tx_id_in_tx_id_key" UNIQUE using index "internal_transfer_links_out_tx_id_in_tx_id_key";

alter table "public"."journal_entries" add constraint "journal_entries_tx_id_fkey" FOREIGN KEY (tx_id) REFERENCES public.wallet_transactions(id) ON DELETE CASCADE not valid;

alter table "public"."journal_entries" validate constraint "journal_entries_tx_id_fkey";

alter table "public"."journal_entries" add constraint "journal_entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."journal_entries" validate constraint "journal_entries_user_id_fkey";

alter table "public"."payment_links" add constraint "payment_links_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."payment_links" validate constraint "payment_links_user_id_fkey";

alter table "public"."payment_merchants" add constraint "payment_merchants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."payment_merchants" validate constraint "payment_merchants_user_id_fkey";

alter table "public"."transaction_purposes" add constraint "transaction_purposes_source_check" CHECK ((source = ANY (ARRAY['wallet'::text, 'exchange'::text]))) not valid;

alter table "public"."transaction_purposes" validate constraint "transaction_purposes_source_check";

alter table "public"."transaction_usages" add constraint "transaction_usages_source_type_check" CHECK ((source_type = ANY (ARRAY['wallet'::text, 'exchange'::text]))) not valid;

alter table "public"."transaction_usages" validate constraint "transaction_usages_source_type_check";

alter table "public"."transaction_usages" add constraint "transaction_usages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."transaction_usages" validate constraint "transaction_usages_user_id_fkey";

alter table "public"."transaction_usages" add constraint "transaction_usages_user_id_source_type_source_id_key" UNIQUE using index "transaction_usages_user_id_source_type_source_id_key";

alter table "public"."transfer_links" add constraint "transfer_links_wallet_tx_id_exchange_transfer_id_key" UNIQUE using index "transfer_links_wallet_tx_id_exchange_transfer_id_key";

alter table "public"."wallets" add constraint "wallets_user_address_unique" UNIQUE using index "wallets_user_address_unique";

alter table "public"."wallets" add constraint "wallets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."wallets" validate constraint "wallets_user_id_fkey";

alter table "public"."clients" add constraint "clients_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."clients" validate constraint "clients_user_id_fkey";

alter table "public"."companies" add constraint "companies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."companies" validate constraint "companies_user_id_fkey";

alter table "public"."exchange_trades" add constraint "exchange_trades_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."exchange_trades" validate constraint "exchange_trades_user_id_fkey";

alter table "public"."transfers" add constraint "transfers_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) not valid;

alter table "public"."transfers" validate constraint "transfers_client_id_fkey";

alter table "public"."transfers" add constraint "transfers_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) not valid;

alter table "public"."transfers" validate constraint "transfers_invoice_id_fkey";

alter table "public"."transfers" add constraint "transfers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."transfers" validate constraint "transfers_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.clear_unused_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.decrypt_secret(enc_input bytea, key_input text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select pgp_sym_decrypt(enc_input, key_input);
$function$
;

CREATE OR REPLACE FUNCTION public.encrypt_secret(plain_input text, key_input text)
 RETURNS bytea
 LANGUAGE sql
AS $function$
  select pgp_sym_encrypt(plain_input, key_input, 'cipher-algo=aes256');
$function$
;

CREATE OR REPLACE FUNCTION public.fn_profiles_mirror_id_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if NEW.user_id is null and NEW.id is not null then
    NEW.user_id := NEW.id;
  end if;

  if NEW.id is null and NEW.user_id is not null then
    NEW.id := NEW.user_id;
  end if;

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_decrypted_connection(p_user_id uuid, p_exchange text)
 RETURNS TABLE(api_key text, api_secret text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'decrypted', 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert a new row into public.profiles, copying the id and email
  -- from the newly created user in auth.users.
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_invoices_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    begin
      new.updated_at := now();
      return new;
    end
    $function$
;

create or replace view "public"."wallet_transaction" as  SELECT id,
    user_id,
    wallet_address,
    chain_id,
    direction,
    tx_hash,
    block_number,
    "timestamp",
    from_address,
    to_address,
    value_wei,
    asset_symbol,
    raw,
    created_at,
    asset_decimals,
    price_usd,
    fiat_value_usd,
    occurred_at
   FROM public.wallet_transactions;


create or replace view "public"."wallet_tx_norm" as  SELECT id,
    user_id,
    ((to_jsonb(t.*) ->> 'chain_id'::text))::integer AS chain_id,
    lower(COALESCE((to_jsonb(t.*) ->> 'direction'::text), ''::text)) AS direction,
    lower(COALESCE((to_jsonb(t.*) ->> 'wallet_address'::text), (to_jsonb(t.*) ->> 'from'::text), (to_jsonb(t.*) ->> 'from_address'::text))) AS wallet_address,
    lower(COALESCE((to_jsonb(t.*) ->> 'counterparty_address'::text), (to_jsonb(t.*) ->> 'to'::text), (to_jsonb(t.*) ->> 'to_address'::text))) AS counterparty_address,
    COALESCE((NULLIF((to_jsonb(t.*) ->> 'amount'::text), ''::text))::numeric, (NULLIF((to_jsonb(t.*) ->> 'value'::text), ''::text))::numeric, (NULLIF((to_jsonb(t.*) ->> 'qty'::text), ''::text))::numeric, (0)::numeric) AS amount,
    COALESCE((NULLIF((to_jsonb(t.*) ->> 'occurred_at'::text), ''::text))::timestamp with time zone, (NULLIF((to_jsonb(t.*) ->> 'block_time'::text), ''::text))::timestamp with time zone, (NULLIF((to_jsonb(t.*) ->> 'timestamp'::text), ''::text))::timestamp with time zone, (NULLIF((to_jsonb(t.*) ->> 'created_at'::text), ''::text))::timestamp with time zone, now()) AS occurred_at,
    COALESCE((to_jsonb(t.*) ->> 'tx_hash'::text), (to_jsonb(t.*) ->> 'transaction_hash'::text), (to_jsonb(t.*) ->> 'hash'::text)) AS tx_hash
   FROM public.wallet_transactions t;


create or replace view "public"."wallet_tx_with_flags" as  SELECT id,
    user_id,
    wallet_address,
    chain_id,
    direction,
    tx_hash,
    block_number,
    "timestamp",
    from_address,
    to_address,
    value_wei,
    asset_symbol,
    raw,
    created_at,
    asset_decimals,
    price_usd,
    fiat_value_usd,
    occurred_at,
    (EXISTS ( SELECT 1
           FROM public.internal_transfer_links l
          WHERE ((l.out_tx_id = t.id) OR (l.in_tx_id = t.id)))) AS is_internal_transfer
   FROM public.wallet_transactions t;


create or replace view "public"."all_transactions" as  WITH latest_fiat_rates AS (
         SELECT DISTINCT ON (daily_exchange_rates.target_currency) daily_exchange_rates.target_currency,
            daily_exchange_rates.rate
           FROM public.daily_exchange_rates
          WHERE ((daily_exchange_rates.source_currency = 'USD'::text) AND (daily_exchange_rates.target_currency = ANY (ARRAY['JPY'::text, 'EUR'::text, 'GBP'::text, 'INR'::text, 'SGD'::text])))
          ORDER BY daily_exchange_rates.target_currency, daily_exchange_rates.date DESC
        ), jpy_to_usd AS (
         SELECT COALESCE((1.0 / NULLIF(daily_exchange_rates.rate, (0)::numeric)), 0.0066) AS rate
           FROM public.daily_exchange_rates
          WHERE ((daily_exchange_rates.source_currency = 'USD'::text) AND (daily_exchange_rates.target_currency = 'JPY'::text))
          ORDER BY daily_exchange_rates.date DESC
         LIMIT 1
        ), base_transactions AS (
         SELECT t.id,
            t.user_id,
            t.reference_id,
            t.date,
            t.source,
            t.chain,
            t.description,
            t.amount,
            t.asset,
            t.price,
            t.raw_value_usd,
            t.usage,
            t.note,
            t.type,
            t.connection_id,
            t.quote_asset,
            t.wallet_address,
            t.connection_name
           FROM ( SELECT (wt.id)::text AS reference_id,
                    ('w_'::text || wt.id) AS id,
                    wt.user_id,
                    wt."timestamp" AS date,
                    'wallet'::text AS source,
                    wc_1.chain,
                    'Wallet Transaction'::text AS description,
                    wt.amount,
                    wt.asset,
                        CASE
                            WHEN ((wt.amount IS NULL) OR (wt.amount = (0)::numeric)) THEN (0)::numeric
                            WHEN ((wt.value_in_usd IS NOT NULL) AND (wt.value_in_usd > (0)::numeric)) THEN (wt.value_in_usd / wt.amount)
                            ELSE COALESCE(( SELECT ap.current_price
                               FROM public.asset_prices ap
                              WHERE (upper(ap.asset) = upper(wt.asset))), (0)::numeric)
                        END AS price,
                    COALESCE(NULLIF(wt.value_in_usd, (0)::numeric), (wt.amount * ( SELECT ap.current_price
                           FROM public.asset_prices ap
                          WHERE (upper(ap.asset) = upper(wt.asset))))) AS raw_value_usd,
                    wt.usage,
                    wt.note,
                    wt.type,
                    (wc_1.id)::text AS connection_id,
                    NULL::text AS quote_asset,
                    wt.wallet_address,
                    NULL::text AS connection_name
                   FROM (public.wallet_transactions wt
                     JOIN public.wallet_connections wc_1 ON (((wt.wallet_address = wc_1.wallet_address) AND (wt.user_id = wc_1.user_id))))
                UNION ALL
                 SELECT et.trade_id AS reference_id,
                    ('e_'::text || et.trade_id) AS id,
                    et.user_id,
                    et.ts AS date,
                    'exchange'::text AS source,
                    ec.exchange AS chain,
                    'Exchange Trade'::text AS description,
                        CASE
                            WHEN (et.side = 'sell'::text) THEN
                            CASE
                                WHEN (et.fee_currency ~ '^[0-9]+\.?[0-9]*$'::text) THEN (et.fee_currency)::numeric
                                ELSE et.amount
                            END
                            ELSE et.amount
                        END AS amount,
                        CASE
                            WHEN (et.symbol ~~ '%/%'::text) THEN split_part(et.symbol, '/'::text, 1)
                            ELSE et.symbol
                        END AS asset,
                    et.price,
                        CASE
                            WHEN (et.symbol ~~ '%/JPY'::text) THEN
                            CASE
                                WHEN (et.side = 'sell'::text) THEN (et.amount * ( SELECT jpy_to_usd.rate
                                   FROM jpy_to_usd))
                                WHEN (et.side = 'buy'::text) THEN
                                CASE
                                    WHEN (et.fee_currency ~ '^[0-9]+\.?[0-9]*$'::text) THEN ((et.fee_currency)::numeric * ( SELECT jpy_to_usd.rate
                                       FROM jpy_to_usd))
                                    ELSE NULL::numeric
                                END
                                ELSE et.value_usd
                            END
                            WHEN (et.side ~~* 'withdraw%'::text) THEN (et.amount * COALESCE(( SELECT ap.current_price
                               FROM public.asset_prices ap
                              WHERE (upper(ap.asset) = upper(
                                    CASE
WHEN (et.symbol ~~ '%/%'::text) THEN split_part(et.symbol, '/'::text, 1)
ELSE et.symbol
                                    END))), (0)::numeric))
                            ELSE COALESCE(et.value_usd, (et.price * et.amount))
                        END AS raw_value_usd,
                    et.usage,
                    et.note,
                    et.side AS type,
                    (ec.id)::text AS connection_id,
                        CASE
                            WHEN (et.symbol ~~ '%/%'::text) THEN split_part(et.symbol, '/'::text, 2)
                            ELSE NULL::text
                        END AS quote_asset,
                    NULL::text AS wallet_address,
                    ec.connection_name
                   FROM (public.exchange_trades et
                     JOIN public.exchange_connections ec ON ((et.exchange_connection_id = ec.id)))) t
        )
 SELECT bt.id,
    bt.user_id,
    bt.reference_id,
    bt.date,
    bt.source,
    bt.chain,
    bt.description,
    bt.amount,
    bt.asset,
    bt.price,
    bt.raw_value_usd AS value_usd,
    (bt.raw_value_usd * COALESCE(( SELECT latest_fiat_rates.rate
           FROM latest_fiat_rates
          WHERE (latest_fiat_rates.target_currency = 'JPY'::text)), (152)::numeric)) AS value_jpy,
    (bt.raw_value_usd * COALESCE(( SELECT latest_fiat_rates.rate
           FROM latest_fiat_rates
          WHERE (latest_fiat_rates.target_currency = 'EUR'::text)), 0.94)) AS value_eur,
    bt.type,
    bt.usage,
    bt.note,
        CASE
            WHEN (bt.source = 'wallet'::text) THEN wc.entity_id
            WHEN (bt.source = 'exchange'::text) THEN xc.entity_id
            ELSE NULL::uuid
        END AS entity_id,
        CASE
            WHEN (bt.source = 'wallet'::text) THEN e_w.name
            WHEN (bt.source = 'exchange'::text) THEN e_e.name
            ELSE NULL::text
        END AS entity_name,
    bt.quote_asset,
    bt.wallet_address,
    bt.connection_name,
    bt.connection_id
   FROM ((((base_transactions bt
     LEFT JOIN public.wallet_connections wc ON (((bt.source = 'wallet'::text) AND (bt.connection_id = (wc.id)::text))))
     LEFT JOIN public.exchange_connections xc ON (((bt.source = 'exchange'::text) AND (bt.connection_id = (xc.id)::text))))
     LEFT JOIN public.entities e_w ON ((wc.entity_id = e_w.id)))
     LEFT JOIN public.entities e_e ON ((xc.entity_id = e_e.id)));


create or replace view "public"."internal_transfer_pairs" as  SELECT tx_out.user_id,
    tx_out.id AS withdrawal_id,
    tx_in.id AS deposit_id
   FROM (public.all_transactions tx_out
     JOIN public.all_transactions tx_in ON (((tx_out.user_id = tx_in.user_id) AND (tx_out.asset = tx_in.asset) AND ((tx_out.type ~~* 'withdraw%'::text) OR (tx_out.type = 'send'::text)) AND ((tx_in.type ~~* 'deposit%'::text) OR (tx_in.type = 'receive'::text)) AND ((tx_in.amount >= (tx_out.amount * 0.999)) AND (tx_in.amount <= tx_out.amount)) AND (tx_in.date > tx_out.date) AND (tx_in.date <= (tx_out.date + '12:00:00'::interval)) AND (COALESCE(tx_out.connection_name, tx_out.wallet_address) <> COALESCE(tx_in.connection_name, tx_in.wallet_address)))));


create or replace view "public"."v_all_transactions_classified" as  WITH all_internal_ids AS (
         SELECT internal_transfer_pairs.withdrawal_id AS id
           FROM public.internal_transfer_pairs
        UNION
         SELECT internal_transfer_pairs.deposit_id AS id
           FROM public.internal_transfer_pairs
        )
 SELECT t.id,
    t.user_id,
    t.reference_id,
    t.date,
    t.source,
    t.chain,
    t.description,
    t.amount,
    t.asset,
    t.price,
    t.value_usd,
    t.value_jpy,
    t.value_eur,
    t.type,
    t.usage,
    t.note,
    t.entity_id,
    t.entity_name,
    t.quote_asset,
    t.wallet_address,
    t.connection_name,
    t.connection_id,
        CASE
            WHEN (ai.id IS NOT NULL) THEN 'INTERNAL_TRANSFER'::text
            WHEN (t.type = ANY (ARRAY['buy'::text, 'sell'::text])) THEN upper(t.type)
            WHEN ((t.type ~~* 'deposit%'::text) OR (t.type ~~* 'receive%'::text)) THEN 'DEPOSIT'::text
            WHEN ((t.type ~~* 'withdraw%'::text) OR (t.type ~~* 'send%'::text)) THEN 'WITHDRAWAL'::text
            ELSE 'OTHER'::text
        END AS transaction_type
   FROM (public.all_transactions t
     LEFT JOIN all_internal_ids ai ON ((t.id = ai.id)));


create or replace view "public"."v_cash_flow_statement" as  SELECT v_all_transactions_classified.user_id,
    v_all_transactions_classified.entity_id,
    v_all_transactions_classified.entity_name AS entity,
    now() AS date,
    'Net Income (Reconciliation Start)'::text AS item,
    sum(
        CASE
            WHEN (v_all_transactions_classified.usage = ANY (ARRAY['sale_profit'::text, 'staking_rewards'::text, 'payment_in_crypto'::text])) THEN v_all_transactions_classified.value_usd
            ELSE (- v_all_transactions_classified.value_usd)
        END) AS amount,
    sum(
        CASE
            WHEN (v_all_transactions_classified.usage = ANY (ARRAY['sale_profit'::text, 'staking_rewards'::text, 'payment_in_crypto'::text])) THEN v_all_transactions_classified.value_usd
            ELSE (- v_all_transactions_classified.value_usd)
        END) AS amount_usd,
    sum(
        CASE
            WHEN (v_all_transactions_classified.usage = ANY (ARRAY['sale_profit'::text, 'staking_rewards'::text, 'payment_in_crypto'::text])) THEN v_all_transactions_classified.value_jpy
            ELSE (- v_all_transactions_classified.value_jpy)
        END) AS amount_jpy,
    sum(
        CASE
            WHEN (v_all_transactions_classified.usage = ANY (ARRAY['sale_profit'::text, 'staking_rewards'::text, 'payment_in_crypto'::text])) THEN v_all_transactions_classified.value_eur
            ELSE (- v_all_transactions_classified.value_eur)
        END) AS amount_eur
   FROM public.v_all_transactions_classified
  WHERE ((v_all_transactions_classified.usage IS NOT NULL) AND (v_all_transactions_classified.usage <> 'cash_purchase'::text) AND (v_all_transactions_classified.transaction_type <> 'INTERNAL_TRANSFER'::text))
  GROUP BY v_all_transactions_classified.user_id, v_all_transactions_classified.entity_id, v_all_transactions_classified.entity_name
UNION ALL
 SELECT v_all_transactions_classified.user_id,
    v_all_transactions_classified.entity_id,
    v_all_transactions_classified.entity_name AS entity,
    v_all_transactions_classified.date,
        CASE
            WHEN (v_all_transactions_classified.usage = 'fair_value_gain'::text) THEN 'Adj: Fair Value Gain'::text
            WHEN (v_all_transactions_classified.usage = 'fair_value_loss'::text) THEN 'Adj: Fair Value Loss'::text
            WHEN (v_all_transactions_classified.usage = 'impairment_loss'::text) THEN 'Adj: Impairment Loss'::text
            WHEN (v_all_transactions_classified.usage = 'sale_profit'::text) THEN 'Adj: Sale Profit'::text
            WHEN (v_all_transactions_classified.usage = 'sale_loss'::text) THEN 'Adj: Sale Loss'::text
            WHEN (v_all_transactions_classified.usage = 'staking_rewards'::text) THEN 'Adj: Non-cash Rewards'::text
            WHEN (v_all_transactions_classified.usage = 'payment_in_crypto'::text) THEN 'Adj: Deemed Sale Gain'::text
            ELSE v_all_transactions_classified.usage
        END AS item,
        CASE
            WHEN (v_all_transactions_classified.usage = ANY (ARRAY['fair_value_gain'::text, 'sale_profit'::text, 'staking_rewards'::text, 'payment_in_crypto'::text])) THEN (- v_all_transactions_classified.value_usd)
            ELSE v_all_transactions_classified.value_usd
        END AS amount,
        CASE
            WHEN (v_all_transactions_classified.usage = ANY (ARRAY['fair_value_gain'::text, 'sale_profit'::text, 'staking_rewards'::text, 'payment_in_crypto'::text])) THEN (- v_all_transactions_classified.value_usd)
            ELSE v_all_transactions_classified.value_usd
        END AS amount_usd,
        CASE
            WHEN (v_all_transactions_classified.usage = ANY (ARRAY['fair_value_gain'::text, 'sale_profit'::text, 'staking_rewards'::text, 'payment_in_crypto'::text])) THEN (- v_all_transactions_classified.value_jpy)
            ELSE v_all_transactions_classified.value_jpy
        END AS amount_jpy,
        CASE
            WHEN (v_all_transactions_classified.usage = ANY (ARRAY['fair_value_gain'::text, 'sale_profit'::text, 'staking_rewards'::text, 'payment_in_crypto'::text])) THEN (- v_all_transactions_classified.value_eur)
            ELSE v_all_transactions_classified.value_eur
        END AS amount_eur
   FROM public.v_all_transactions_classified
  WHERE (v_all_transactions_classified.usage = ANY (ARRAY['fair_value_gain'::text, 'fair_value_loss'::text, 'impairment_loss'::text, 'sale_profit'::text, 'sale_loss'::text, 'staking_rewards'::text, 'payment_in_crypto'::text]))
UNION ALL
 SELECT v_all_transactions_classified.user_id,
    v_all_transactions_classified.entity_id,
    v_all_transactions_classified.entity_name AS entity,
    v_all_transactions_classified.date,
    'Acquisition of Crypto Assets'::text AS item,
    (- v_all_transactions_classified.value_usd) AS amount,
    (- v_all_transactions_classified.value_usd) AS amount_usd,
    (- v_all_transactions_classified.value_jpy) AS amount_jpy,
    (- v_all_transactions_classified.value_eur) AS amount_eur
   FROM public.v_all_transactions_classified
  WHERE (v_all_transactions_classified.usage = 'cash_purchase'::text)
UNION ALL
 SELECT v_all_transactions_classified.user_id,
    v_all_transactions_classified.entity_id,
    v_all_transactions_classified.entity_name AS entity,
    v_all_transactions_classified.date,
    'Proceeds from Sale of Crypto Assets'::text AS item,
    v_all_transactions_classified.value_usd AS amount,
    v_all_transactions_classified.value_usd AS amount_usd,
    v_all_transactions_classified.value_jpy AS amount_jpy,
    v_all_transactions_classified.value_eur AS amount_eur
   FROM public.v_all_transactions_classified
  WHERE (v_all_transactions_classified.usage = ANY (ARRAY['sale_profit'::text, 'sale_loss'::text]));


create or replace view "public"."v_holdings" as  WITH latest_rates AS (
         SELECT DISTINCT ON (daily_exchange_rates.target_currency) daily_exchange_rates.target_currency,
            daily_exchange_rates.rate
           FROM public.daily_exchange_rates
          WHERE ((daily_exchange_rates.source_currency = 'USD'::text) AND (daily_exchange_rates.target_currency = ANY (ARRAY['JPY'::text, 'EUR'::text, 'GBP'::text, 'INR'::text, 'SGD'::text])))
          ORDER BY daily_exchange_rates.target_currency, daily_exchange_rates.date DESC
        ), current_quantities AS (
         SELECT v_all_transactions_classified.user_id,
            v_all_transactions_classified.entity_id,
            v_all_transactions_classified.entity_name,
            v_all_transactions_classified.asset,
            sum(
                CASE
                    WHEN (upper(v_all_transactions_classified.type) = ANY (ARRAY['IN'::text, 'DEPOSIT'::text, 'BUY'::text, 'RECEIVE'::text])) THEN v_all_transactions_classified.amount
                    WHEN (upper(v_all_transactions_classified.type) = ANY (ARRAY['OUT'::text, 'WITHDRAWAL'::text, 'SELL'::text, 'SEND'::text])) THEN (- v_all_transactions_classified.amount)
                    ELSE (0)::numeric
                END) AS current_amount
           FROM public.v_all_transactions_classified
          WHERE (v_all_transactions_classified.transaction_type <> 'INTERNAL_TRANSFER'::text)
          GROUP BY v_all_transactions_classified.user_id, v_all_transactions_classified.entity_id, v_all_transactions_classified.entity_name, v_all_transactions_classified.asset
        )
 SELECT cq.user_id,
    cq.entity_id,
    cq.entity_name AS entity,
    cq.asset,
    cq.current_amount,
    COALESCE(ap.current_price, (0)::numeric) AS current_price,
    (cq.current_amount * COALESCE(ap.current_price, (0)::numeric)) AS current_value_usd,
    ((cq.current_amount * COALESCE(ap.current_price, (0)::numeric)) * COALESCE(( SELECT latest_rates.rate
           FROM latest_rates
          WHERE (latest_rates.target_currency = 'JPY'::text)), (1)::numeric)) AS current_value_jpy,
    ((cq.current_amount * COALESCE(ap.current_price, (0)::numeric)) * COALESCE(( SELECT latest_rates.rate
           FROM latest_rates
          WHERE (latest_rates.target_currency = 'EUR'::text)), (1)::numeric)) AS current_value_eur,
    now() AS last_updated
   FROM (current_quantities cq
     LEFT JOIN public.asset_prices ap ON ((TRIM(BOTH FROM upper(cq.asset)) = TRIM(BOTH FROM upper(ap.asset)))))
  WHERE (cq.current_amount > 0.000000001);


create or replace view "public"."v_profit_loss_statement" as  SELECT user_id,
    entity_id,
    entity_name AS entity,
    date,
        CASE
            WHEN (usage = 'staking_rewards'::text) THEN 'Other Revenue / Sales'::text
            WHEN (usage = 'sale_profit'::text) THEN 'Realized Gain (Non-operating)'::text
            WHEN (usage = 'sale_loss'::text) THEN 'Realized Loss (Non-operating)'::text
            WHEN (usage = 'fair_value_gain'::text) THEN 'Fair Value Gain (Non-operating)'::text
            WHEN (usage = 'fair_value_loss'::text) THEN 'Fair Value Loss (Non-operating)'::text
            WHEN (usage = 'impairment_loss'::text) THEN 'Impairment Loss (Extraordinary)'::text
            WHEN (usage = 'payment_in_crypto'::text) THEN 'Realized Gain (Deemed)'::text
            ELSE usage
        END AS account,
    value_usd AS balance,
    value_usd AS balance_usd,
    value_jpy AS balance_jpy,
    value_eur AS balance_eur
   FROM public.v_all_transactions_classified
  WHERE ((usage IS NOT NULL) AND (usage <> 'cash_purchase'::text) AND (transaction_type <> 'INTERNAL_TRANSFER'::text));


create or replace view "public"."internal_transfer_candidates" as  SELECT o.id AS out_tx_id,
    i.id AS in_tx_id,
    o.user_id,
    o.chain_id,
    abs((o.amount - i.amount)) AS amount_delta,
        CASE
            WHEN (GREATEST(o.amount, i.amount) = (0)::numeric) THEN (0)::numeric
            ELSE (abs((o.amount - i.amount)) / GREATEST(o.amount, i.amount))
        END AS amount_delta_rate,
    abs(EXTRACT(epoch FROM (i.occurred_at - o.occurred_at))) AS diff_seconds,
        CASE
            WHEN ((o.tx_hash IS NOT NULL) AND (o.tx_hash = i.tx_hash)) THEN 'same_tx_hash'::text
            WHEN ((o.counterparty_address IS NOT NULL) AND (o.counterparty_address = i.wallet_address)) THEN 'out->in_addr_match'::text
            WHEN ((i.counterparty_address IS NOT NULL) AND (i.counterparty_address = o.wallet_address)) THEN 'in->out_addr_match'::text
            ELSE 'amount_time_heuristic'::text
        END AS reason
   FROM (public.wallet_tx_norm o
     JOIN public.wallet_tx_norm i ON (((o.user_id = i.user_id) AND ((o.chain_id IS NULL) OR (i.chain_id IS NULL) OR (o.chain_id = i.chain_id)) AND (COALESCE(o.direction, ''::text) ~~ 'out%'::text) AND (COALESCE(i.direction, ''::text) ~~ 'in%'::text) AND ((abs((o.amount - i.amount)) <= 0.000001) OR (
        CASE
            WHEN (GREATEST(o.amount, i.amount) = (0)::numeric) THEN (0)::numeric
            ELSE (abs((o.amount - i.amount)) / GREATEST(o.amount, i.amount))
        END <= 0.005)) AND (abs(EXTRACT(epoch FROM (i.occurred_at - o.occurred_at))) <= (7200)::numeric) AND (o.id <> i.id))));


create or replace view "public"."v_balance_sheet" as  SELECT user_id,
    entity_id,
    entity AS entity_name,
    timezone('utc'::text, now()) AS date,
    'Cryptocurrency Assets'::text AS account,
    current_value_usd AS balance,
    current_value_usd AS balance_usd,
    current_value_jpy AS balance_jpy,
    current_value_eur AS balance_eur
   FROM public.v_holdings;


grant delete on table "public"."exchange_accounts" to "anon";

grant insert on table "public"."exchange_accounts" to "anon";

grant references on table "public"."exchange_accounts" to "anon";

grant select on table "public"."exchange_accounts" to "anon";

grant trigger on table "public"."exchange_accounts" to "anon";

grant truncate on table "public"."exchange_accounts" to "anon";

grant update on table "public"."exchange_accounts" to "anon";

grant delete on table "public"."exchange_accounts" to "authenticated";

grant insert on table "public"."exchange_accounts" to "authenticated";

grant references on table "public"."exchange_accounts" to "authenticated";

grant select on table "public"."exchange_accounts" to "authenticated";

grant trigger on table "public"."exchange_accounts" to "authenticated";

grant truncate on table "public"."exchange_accounts" to "authenticated";

grant update on table "public"."exchange_accounts" to "authenticated";

grant delete on table "public"."exchange_accounts" to "service_role";

grant insert on table "public"."exchange_accounts" to "service_role";

grant references on table "public"."exchange_accounts" to "service_role";

grant select on table "public"."exchange_accounts" to "service_role";

grant trigger on table "public"."exchange_accounts" to "service_role";

grant truncate on table "public"."exchange_accounts" to "service_role";

grant update on table "public"."exchange_accounts" to "service_role";

grant delete on table "public"."exchange_api_credentials" to "anon";

grant insert on table "public"."exchange_api_credentials" to "anon";

grant references on table "public"."exchange_api_credentials" to "anon";

grant select on table "public"."exchange_api_credentials" to "anon";

grant trigger on table "public"."exchange_api_credentials" to "anon";

grant truncate on table "public"."exchange_api_credentials" to "anon";

grant update on table "public"."exchange_api_credentials" to "anon";

grant delete on table "public"."exchange_api_credentials" to "authenticated";

grant insert on table "public"."exchange_api_credentials" to "authenticated";

grant references on table "public"."exchange_api_credentials" to "authenticated";

grant select on table "public"."exchange_api_credentials" to "authenticated";

grant trigger on table "public"."exchange_api_credentials" to "authenticated";

grant truncate on table "public"."exchange_api_credentials" to "authenticated";

grant update on table "public"."exchange_api_credentials" to "authenticated";

grant delete on table "public"."exchange_api_credentials" to "service_role";

grant insert on table "public"."exchange_api_credentials" to "service_role";

grant references on table "public"."exchange_api_credentials" to "service_role";

grant select on table "public"."exchange_api_credentials" to "service_role";

grant trigger on table "public"."exchange_api_credentials" to "service_role";

grant truncate on table "public"."exchange_api_credentials" to "service_role";

grant update on table "public"."exchange_api_credentials" to "service_role";

grant delete on table "public"."exchange_balances" to "anon";

grant insert on table "public"."exchange_balances" to "anon";

grant references on table "public"."exchange_balances" to "anon";

grant select on table "public"."exchange_balances" to "anon";

grant trigger on table "public"."exchange_balances" to "anon";

grant truncate on table "public"."exchange_balances" to "anon";

grant update on table "public"."exchange_balances" to "anon";

grant delete on table "public"."exchange_balances" to "authenticated";

grant insert on table "public"."exchange_balances" to "authenticated";

grant references on table "public"."exchange_balances" to "authenticated";

grant select on table "public"."exchange_balances" to "authenticated";

grant trigger on table "public"."exchange_balances" to "authenticated";

grant truncate on table "public"."exchange_balances" to "authenticated";

grant update on table "public"."exchange_balances" to "authenticated";

grant delete on table "public"."exchange_balances" to "service_role";

grant insert on table "public"."exchange_balances" to "service_role";

grant references on table "public"."exchange_balances" to "service_role";

grant select on table "public"."exchange_balances" to "service_role";

grant trigger on table "public"."exchange_balances" to "service_role";

grant truncate on table "public"."exchange_balances" to "service_role";

grant update on table "public"."exchange_balances" to "service_role";

grant delete on table "public"."exchange_trade_values" to "anon";

grant insert on table "public"."exchange_trade_values" to "anon";

grant references on table "public"."exchange_trade_values" to "anon";

grant select on table "public"."exchange_trade_values" to "anon";

grant trigger on table "public"."exchange_trade_values" to "anon";

grant truncate on table "public"."exchange_trade_values" to "anon";

grant update on table "public"."exchange_trade_values" to "anon";

grant delete on table "public"."exchange_trade_values" to "authenticated";

grant insert on table "public"."exchange_trade_values" to "authenticated";

grant references on table "public"."exchange_trade_values" to "authenticated";

grant select on table "public"."exchange_trade_values" to "authenticated";

grant trigger on table "public"."exchange_trade_values" to "authenticated";

grant truncate on table "public"."exchange_trade_values" to "authenticated";

grant update on table "public"."exchange_trade_values" to "authenticated";

grant delete on table "public"."exchange_trade_values" to "service_role";

grant insert on table "public"."exchange_trade_values" to "service_role";

grant references on table "public"."exchange_trade_values" to "service_role";

grant select on table "public"."exchange_trade_values" to "service_role";

grant trigger on table "public"."exchange_trade_values" to "service_role";

grant truncate on table "public"."exchange_trade_values" to "service_role";

grant update on table "public"."exchange_trade_values" to "service_role";

grant delete on table "public"."exchange_transfers" to "anon";

grant insert on table "public"."exchange_transfers" to "anon";

grant references on table "public"."exchange_transfers" to "anon";

grant select on table "public"."exchange_transfers" to "anon";

grant trigger on table "public"."exchange_transfers" to "anon";

grant truncate on table "public"."exchange_transfers" to "anon";

grant update on table "public"."exchange_transfers" to "anon";

grant delete on table "public"."exchange_transfers" to "authenticated";

grant insert on table "public"."exchange_transfers" to "authenticated";

grant references on table "public"."exchange_transfers" to "authenticated";

grant select on table "public"."exchange_transfers" to "authenticated";

grant trigger on table "public"."exchange_transfers" to "authenticated";

grant truncate on table "public"."exchange_transfers" to "authenticated";

grant update on table "public"."exchange_transfers" to "authenticated";

grant delete on table "public"."exchange_transfers" to "service_role";

grant insert on table "public"."exchange_transfers" to "service_role";

grant references on table "public"."exchange_transfers" to "service_role";

grant select on table "public"."exchange_transfers" to "service_role";

grant trigger on table "public"."exchange_transfers" to "service_role";

grant truncate on table "public"."exchange_transfers" to "service_role";

grant update on table "public"."exchange_transfers" to "service_role";

grant delete on table "public"."internal_transfer_links" to "anon";

grant insert on table "public"."internal_transfer_links" to "anon";

grant references on table "public"."internal_transfer_links" to "anon";

grant select on table "public"."internal_transfer_links" to "anon";

grant trigger on table "public"."internal_transfer_links" to "anon";

grant truncate on table "public"."internal_transfer_links" to "anon";

grant update on table "public"."internal_transfer_links" to "anon";

grant delete on table "public"."internal_transfer_links" to "authenticated";

grant insert on table "public"."internal_transfer_links" to "authenticated";

grant references on table "public"."internal_transfer_links" to "authenticated";

grant select on table "public"."internal_transfer_links" to "authenticated";

grant trigger on table "public"."internal_transfer_links" to "authenticated";

grant truncate on table "public"."internal_transfer_links" to "authenticated";

grant update on table "public"."internal_transfer_links" to "authenticated";

grant delete on table "public"."internal_transfer_links" to "service_role";

grant insert on table "public"."internal_transfer_links" to "service_role";

grant references on table "public"."internal_transfer_links" to "service_role";

grant select on table "public"."internal_transfer_links" to "service_role";

grant trigger on table "public"."internal_transfer_links" to "service_role";

grant truncate on table "public"."internal_transfer_links" to "service_role";

grant update on table "public"."internal_transfer_links" to "service_role";

grant delete on table "public"."payment_links" to "anon";

grant insert on table "public"."payment_links" to "anon";

grant references on table "public"."payment_links" to "anon";

grant select on table "public"."payment_links" to "anon";

grant trigger on table "public"."payment_links" to "anon";

grant truncate on table "public"."payment_links" to "anon";

grant update on table "public"."payment_links" to "anon";

grant delete on table "public"."payment_links" to "authenticated";

grant insert on table "public"."payment_links" to "authenticated";

grant references on table "public"."payment_links" to "authenticated";

grant select on table "public"."payment_links" to "authenticated";

grant trigger on table "public"."payment_links" to "authenticated";

grant truncate on table "public"."payment_links" to "authenticated";

grant update on table "public"."payment_links" to "authenticated";

grant delete on table "public"."payment_links" to "service_role";

grant insert on table "public"."payment_links" to "service_role";

grant references on table "public"."payment_links" to "service_role";

grant select on table "public"."payment_links" to "service_role";

grant trigger on table "public"."payment_links" to "service_role";

grant truncate on table "public"."payment_links" to "service_role";

grant update on table "public"."payment_links" to "service_role";

grant delete on table "public"."payment_merchants" to "anon";

grant insert on table "public"."payment_merchants" to "anon";

grant references on table "public"."payment_merchants" to "anon";

grant select on table "public"."payment_merchants" to "anon";

grant trigger on table "public"."payment_merchants" to "anon";

grant truncate on table "public"."payment_merchants" to "anon";

grant update on table "public"."payment_merchants" to "anon";

grant delete on table "public"."payment_merchants" to "authenticated";

grant insert on table "public"."payment_merchants" to "authenticated";

grant references on table "public"."payment_merchants" to "authenticated";

grant select on table "public"."payment_merchants" to "authenticated";

grant trigger on table "public"."payment_merchants" to "authenticated";

grant truncate on table "public"."payment_merchants" to "authenticated";

grant update on table "public"."payment_merchants" to "authenticated";

grant delete on table "public"."payment_merchants" to "service_role";

grant insert on table "public"."payment_merchants" to "service_role";

grant references on table "public"."payment_merchants" to "service_role";

grant select on table "public"."payment_merchants" to "service_role";

grant trigger on table "public"."payment_merchants" to "service_role";

grant truncate on table "public"."payment_merchants" to "service_role";

grant update on table "public"."payment_merchants" to "service_role";

grant delete on table "public"."transaction_purposes" to "anon";

grant insert on table "public"."transaction_purposes" to "anon";

grant references on table "public"."transaction_purposes" to "anon";

grant select on table "public"."transaction_purposes" to "anon";

grant trigger on table "public"."transaction_purposes" to "anon";

grant truncate on table "public"."transaction_purposes" to "anon";

grant update on table "public"."transaction_purposes" to "anon";

grant delete on table "public"."transaction_purposes" to "authenticated";

grant insert on table "public"."transaction_purposes" to "authenticated";

grant references on table "public"."transaction_purposes" to "authenticated";

grant select on table "public"."transaction_purposes" to "authenticated";

grant trigger on table "public"."transaction_purposes" to "authenticated";

grant truncate on table "public"."transaction_purposes" to "authenticated";

grant update on table "public"."transaction_purposes" to "authenticated";

grant delete on table "public"."transaction_purposes" to "service_role";

grant insert on table "public"."transaction_purposes" to "service_role";

grant references on table "public"."transaction_purposes" to "service_role";

grant select on table "public"."transaction_purposes" to "service_role";

grant trigger on table "public"."transaction_purposes" to "service_role";

grant truncate on table "public"."transaction_purposes" to "service_role";

grant update on table "public"."transaction_purposes" to "service_role";

grant delete on table "public"."transaction_usages" to "anon";

grant insert on table "public"."transaction_usages" to "anon";

grant references on table "public"."transaction_usages" to "anon";

grant select on table "public"."transaction_usages" to "anon";

grant trigger on table "public"."transaction_usages" to "anon";

grant truncate on table "public"."transaction_usages" to "anon";

grant update on table "public"."transaction_usages" to "anon";

grant delete on table "public"."transaction_usages" to "authenticated";

grant insert on table "public"."transaction_usages" to "authenticated";

grant references on table "public"."transaction_usages" to "authenticated";

grant select on table "public"."transaction_usages" to "authenticated";

grant trigger on table "public"."transaction_usages" to "authenticated";

grant truncate on table "public"."transaction_usages" to "authenticated";

grant update on table "public"."transaction_usages" to "authenticated";

grant delete on table "public"."transaction_usages" to "service_role";

grant insert on table "public"."transaction_usages" to "service_role";

grant references on table "public"."transaction_usages" to "service_role";

grant select on table "public"."transaction_usages" to "service_role";

grant trigger on table "public"."transaction_usages" to "service_role";

grant truncate on table "public"."transaction_usages" to "service_role";

grant update on table "public"."transaction_usages" to "service_role";

grant delete on table "public"."transfer_links" to "anon";

grant insert on table "public"."transfer_links" to "anon";

grant references on table "public"."transfer_links" to "anon";

grant select on table "public"."transfer_links" to "anon";

grant trigger on table "public"."transfer_links" to "anon";

grant truncate on table "public"."transfer_links" to "anon";

grant update on table "public"."transfer_links" to "anon";

grant delete on table "public"."transfer_links" to "authenticated";

grant insert on table "public"."transfer_links" to "authenticated";

grant references on table "public"."transfer_links" to "authenticated";

grant select on table "public"."transfer_links" to "authenticated";

grant trigger on table "public"."transfer_links" to "authenticated";

grant truncate on table "public"."transfer_links" to "authenticated";

grant update on table "public"."transfer_links" to "authenticated";

grant delete on table "public"."transfer_links" to "service_role";

grant insert on table "public"."transfer_links" to "service_role";

grant references on table "public"."transfer_links" to "service_role";

grant select on table "public"."transfer_links" to "service_role";

grant trigger on table "public"."transfer_links" to "service_role";

grant truncate on table "public"."transfer_links" to "service_role";

grant update on table "public"."transfer_links" to "service_role";

grant delete on table "public"."wallet_nonces" to "anon";

grant insert on table "public"."wallet_nonces" to "anon";

grant references on table "public"."wallet_nonces" to "anon";

grant select on table "public"."wallet_nonces" to "anon";

grant trigger on table "public"."wallet_nonces" to "anon";

grant truncate on table "public"."wallet_nonces" to "anon";

grant update on table "public"."wallet_nonces" to "anon";

grant delete on table "public"."wallet_nonces" to "authenticated";

grant insert on table "public"."wallet_nonces" to "authenticated";

grant references on table "public"."wallet_nonces" to "authenticated";

grant select on table "public"."wallet_nonces" to "authenticated";

grant trigger on table "public"."wallet_nonces" to "authenticated";

grant truncate on table "public"."wallet_nonces" to "authenticated";

grant update on table "public"."wallet_nonces" to "authenticated";

grant delete on table "public"."wallet_nonces" to "service_role";

grant insert on table "public"."wallet_nonces" to "service_role";

grant references on table "public"."wallet_nonces" to "service_role";

grant select on table "public"."wallet_nonces" to "service_role";

grant trigger on table "public"."wallet_nonces" to "service_role";

grant truncate on table "public"."wallet_nonces" to "service_role";

grant update on table "public"."wallet_nonces" to "service_role";

grant delete on table "public"."wallets" to "anon";

grant insert on table "public"."wallets" to "anon";

grant references on table "public"."wallets" to "anon";

grant select on table "public"."wallets" to "anon";

grant trigger on table "public"."wallets" to "anon";

grant truncate on table "public"."wallets" to "anon";

grant update on table "public"."wallets" to "anon";

grant delete on table "public"."wallets" to "authenticated";

grant insert on table "public"."wallets" to "authenticated";

grant references on table "public"."wallets" to "authenticated";

grant select on table "public"."wallets" to "authenticated";

grant trigger on table "public"."wallets" to "authenticated";

grant truncate on table "public"."wallets" to "authenticated";

grant update on table "public"."wallets" to "authenticated";

grant delete on table "public"."wallets" to "service_role";

grant insert on table "public"."wallets" to "service_role";

grant references on table "public"."wallets" to "service_role";

grant select on table "public"."wallets" to "service_role";

grant trigger on table "public"."wallets" to "service_role";

grant truncate on table "public"."wallets" to "service_role";

grant update on table "public"."wallets" to "service_role";


  create policy "auth_select_audit_logs"
  on "public"."audit_logs"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "clients_ins_own"
  on "public"."clients"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "clients_select_own"
  on "public"."clients"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "clients_upd_own"
  on "public"."clients"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "companies_ins_own"
  on "public"."companies"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "companies_select_own"
  on "public"."companies"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "companies_upd_own"
  on "public"."companies"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "auth_select_crypto_payments"
  on "public"."crypto_payments"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "auth_insert_customers"
  on "public"."customers"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "auth_select_customers"
  on "public"."customers"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "auth_update_customers"
  on "public"."customers"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "customers_ins_own"
  on "public"."customers"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "customers_select_own"
  on "public"."customers"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "customers_upd_own"
  on "public"."customers"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "cred_delete_own"
  on "public"."exchange_api_credentials"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "cred_select_own"
  on "public"."exchange_api_credentials"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "cred_upsert_own"
  on "public"."exchange_api_credentials"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "allow_user_select_own_exchange_connections"
  on "public"."exchange_connections"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "exchange_connections owner rw"
  on "public"."exchange_connections"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "vce_delete_own"
  on "public"."exchange_connections"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "vce_insert_own"
  on "public"."exchange_connections"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "vce_select_own"
  on "public"."exchange_connections"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "vce_update_own"
  on "public"."exchange_connections"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "allow_user_manage_exchange_trade_values"
  on "public"."exchange_trade_values"
  as permissive
  for all
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "allow_user_select_own_exchange_trades"
  on "public"."exchange_trades"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "allow_user_update_own_exchange_trades"
  on "public"."exchange_trades"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "auth_insert_invoices"
  on "public"."invoices"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "auth_select_invoices"
  on "public"."invoices"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "auth_update_invoices"
  on "public"."invoices"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "invoices_delete_own"
  on "public"."invoices"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "invoices_ins_own"
  on "public"."invoices"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "invoices_insert_own"
  on "public"."invoices"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "invoices_select_own"
  on "public"."invoices"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "invoices_upd_own"
  on "public"."invoices"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "invoices_update_own"
  on "public"."invoices"
  as permissive
  for update
  to public
using ((user_id = auth.uid()));



  create policy "je_delete_own"
  on "public"."journal_entries"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "je_insert_own"
  on "public"."journal_entries"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "je_select_own"
  on "public"."journal_entries"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "je_self_all"
  on "public"."journal_entries"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "je_update_own"
  on "public"."journal_entries"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "jl_upd_owner"
  on "public"."journal_lines"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.journal_entries je
  WHERE ((je.id = journal_lines.entry_id) AND (je.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM public.journal_entries je
  WHERE ((je.id = journal_lines.entry_id) AND (je.user_id = auth.uid())))));



  create policy "auth_select_meter_events"
  on "public"."meter_events"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "pl_ins_own"
  on "public"."payment_links"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "pl_select_own"
  on "public"."payment_links"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "pm_select_own"
  on "public"."payment_merchants"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "pm_upsert_own"
  on "public"."payment_merchants"
  as permissive
  for all
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "Insert own profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "auth_insert_profiles"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "auth_select_profiles"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "auth_update_profiles"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "profiles_select_own"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((id = auth.uid()));



  create policy "profiles_upsert_own"
  on "public"."profiles"
  as permissive
  for all
  to public
using ((id = auth.uid()))
with check ((id = auth.uid()));



  create policy "tp_select_own"
  on "public"."transaction_purposes"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "tp_upsert_own"
  on "public"."transaction_purposes"
  as permissive
  for all
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "labels_delete_own"
  on "public"."transaction_usage_labels"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "labels_select_own"
  on "public"."transaction_usage_labels"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "labels_update_own"
  on "public"."transaction_usage_labels"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "labels_upsert_own"
  on "public"."transaction_usage_labels"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "auth_select_transactions"
  on "public"."transactions"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "auth_select_user_monthly_counters"
  on "public"."user_monthly_counters"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "auth_select_user_sessions"
  on "public"."user_sessions"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "allow_user_select_own_wallet_connections"
  on "public"."wallet_connections"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "auth_delete_wallets"
  on "public"."wallet_connections"
  as permissive
  for delete
  to authenticated
using ((user_id = auth.uid()));



  create policy "auth_insert_wallets"
  on "public"."wallet_connections"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "auth_select_wallets"
  on "public"."wallet_connections"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "auth_update_wallets"
  on "public"."wallet_connections"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "auth_select_wallet_nonces"
  on "public"."wallet_nonces"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "auth_upsert_wallet_nonces"
  on "public"."wallet_nonces"
  as permissive
  for all
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "allow_user_select_own_wallet_transactions"
  on "public"."wallet_transactions"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "allow_user_update_own_wallet_transactions"
  on "public"."wallet_transactions"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "tx_delete_self"
  on "public"."wallet_transactions"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "tx_insert_self"
  on "public"."wallet_transactions"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "tx_select_self"
  on "public"."wallet_transactions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "tx_update_self"
  on "public"."wallet_transactions"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "wt_insert_own"
  on "public"."wallet_transactions"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "wt_select_own"
  on "public"."wallet_transactions"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "wtx_delete_own"
  on "public"."wallet_transactions"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "wtx_insert_own"
  on "public"."wallet_transactions"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "wtx_select_own"
  on "public"."wallet_transactions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "wtx_update_own"
  on "public"."wallet_transactions"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "auth_select_wallets"
  on "public"."wallets"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "auth_upsert_wallets"
  on "public"."wallets"
  as permissive
  for all
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "wallets select own"
  on "public"."wallets"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "wallets update own"
  on "public"."wallets"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "wallets upsert own"
  on "public"."wallets"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "wallets_del_own"
  on "public"."wallets"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "wallets_delete_own"
  on "public"."wallets"
  as permissive
  for delete
  to authenticated
using ((user_id = auth.uid()));



  create policy "wallets_delete_self"
  on "public"."wallets"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "wallets_ins"
  on "public"."wallets"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "wallets_ins_own"
  on "public"."wallets"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "wallets_insert_own"
  on "public"."wallets"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "wallets_insert_self"
  on "public"."wallets"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "wallets_sel"
  on "public"."wallets"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "wallets_select_own"
  on "public"."wallets"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "wallets_select_self"
  on "public"."wallets"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "wallets_upd"
  on "public"."wallets"
  as permissive
  for update
  to public
using ((user_id = auth.uid()));



  create policy "wallets_upd_own"
  on "public"."wallets"
  as permissive
  for update
  to public
using ((user_id = auth.uid()));



  create policy "wallets_update_own"
  on "public"."wallets"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()));



  create policy "wallets_update_self"
  on "public"."wallets"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


CREATE TRIGGER tr_invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_set_updated_at();

CREATE TRIGGER clear_profile_fields_trigger BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.clear_unused_profile_fields();

CREATE TRIGGER profiles_mirror_id_user_id BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_mirror_id_user_id();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


