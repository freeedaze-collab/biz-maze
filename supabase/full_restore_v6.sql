-- File: 20250918014130_007cfe61-9be5-48a3-8bb6-9c13145f0b66.sql
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallet_connections table for connecting crypto wallets to user accounts
CREATE TABLE public.wallet_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  wallet_type TEXT NOT NULL, -- 'metamask', 'coinbase', 'exodus', etc.
  wallet_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  balance_usd DECIMAL(20,8) DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, wallet_address)
);

-- Create transactions table for storing transaction history
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  transaction_hash TEXT UNIQUE,
  transaction_type TEXT NOT NULL, -- 'send', 'receive', 'swap', 'stake'
  amount DECIMAL(20,8) NOT NULL,
  currency TEXT NOT NULL, -- 'ETH', 'BTC', 'USDT', etc.
  usd_value DECIMAL(20,2),
  from_address TEXT,
  to_address TEXT,
  gas_fee DECIMAL(20,8),
  gas_fee_usd DECIMAL(20,2),
  block_number BIGINT,
  transaction_status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  blockchain_network TEXT NOT NULL, -- 'ethereum', 'bitcoin', 'polygon', etc.
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create crypto_payments table for payment requests
CREATE TABLE public.crypto_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id TEXT,
  recipient_address TEXT NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  currency TEXT NOT NULL,
  usd_amount DECIMAL(20,2),
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  transaction_hash TEXT,
  wallet_address TEXT,
  gas_fee DECIMAL(20,8),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Create RLS policies for wallet_connections table
CREATE POLICY "Users can view their own wallet connections"
ON public.wallet_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wallet connections"
ON public.wallet_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet connections"
ON public.wallet_connections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wallet connections"
ON public.wallet_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for transactions table
CREATE POLICY "Users can view their own transactions"
ON public.transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id);

-- Create RLS policies for crypto_payments table
CREATE POLICY "Users can view their own crypto payments"
ON public.crypto_payments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own crypto payments"
ON public.crypto_payments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own crypto payments"
ON public.crypto_payments
FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_wallet_connections_user_id ON public.wallet_connections(user_id);
CREATE INDEX idx_wallet_connections_address ON public.wallet_connections(wallet_address);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_wallet_address ON public.transactions(wallet_address);
CREATE INDEX idx_transactions_hash ON public.transactions(transaction_hash);
CREATE INDEX idx_crypto_payments_user_id ON public.crypto_payments(user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallet_connections_updated_at
  BEFORE UPDATE ON public.wallet_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crypto_payments_updated_at
  BEFORE UPDATE ON public.crypto_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- File: 20250926040953_d6281e4e-b8f6-41ae-900d-c103d92bec59.sql
-- Add new tables and columns for comprehensive financial platform

-- Add memo field to invoices (assuming we need to create invoices table)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID,
  invoice_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'unpaid',
  memo TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add customers table with soft delete
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  address TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add seat limits and plan info to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS seats_limit INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'individual_free',
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'individual'; -- individual or corporate

-- Add metered billing tables
CREATE TABLE IF NOT EXISTS public.meter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'remittance', 'invoice', 'payment', 'exchange'  
  amount NUMERIC,
  currency TEXT,
  cost NUMERIC NOT NULL, -- cost for this event
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_monthly_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_year TEXT NOT NULL, -- '2025-01' format
  event_count INTEGER DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  bundles_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_year)
);

-- Add audit log table for security
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add user sessions for IP/device tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own customers" ON public.customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own meter events" ON public.meter_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own monthly counters" ON public.user_monthly_counters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own sessions" ON public.user_sessions FOR SELECT USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_meter_events_user_id ON public.meter_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);

-- Add update triggers
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_monthly_counters_updated_at BEFORE UPDATE ON public.user_monthly_counters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- File: 20251008_wallet_history.sql
-- public.wallet_transactions: 騾｣謳ｺ繧ｦ繧ｩ繝ｬ繝・ヨ縺ｮ繝√ぉ繝ｼ繝ｳ螻･豁ｴ繧剃ｿ晏ｭ・
create table if not exists public.wallet_transactions (
  id            bigserial primary key,
  user_id       uuid not null,
  wallet_address text not null,
  chain_id      bigint not null default 1,           -- 縺ｾ縺壹・ ETH Mainnet 繧貞燕謠撰ｼ亥ｿ・ｦ√↑繧画僑蠑ｵ・・
  direction     text not null,                       -- 'in' | 'out' | 'self'
  tx_hash       text not null unique,                -- 蜷御ｸ繝医Λ繝ｳ繧ｶ繧ｯ繧ｷ繝ｧ繝ｳ縺ｯ荳諢・
  block_number  bigint,
  timestamp     timestamptz,
  from_address  text,
  to_address    text,
  value_wei     numeric,                             -- 繝阪う繝・ぅ繝・ETH 縺ｮ蝣ｴ蜷医↓譬ｼ邏搾ｼ井ｻｻ諢擾ｼ・
  asset_symbol  text,                                -- ERC20 縺ｪ縺ｩ縺ｮ繧ｷ繝ｳ繝懊Ν・井ｻｻ諢擾ｼ・
  raw           jsonb not null default '{}'::jsonb,  -- 蜿門ｾ励＠縺溽函繝・・繧ｿ荳蠑・
  created_at    timestamptz not null default now()
);

-- 譛邨ょ酔譛溘ヶ繝ｭ繝・け繧定ｦ壹∴繧九せ繝・・繝・
create table if not exists public.wallet_sync_state (
  user_id        uuid primary key,
  wallet_address text not null,
  chain_id       bigint not null default 1,
  last_block     bigint not null default 0,
  updated_at     timestamptz not null default now()
);

-- RLS
alter table public.wallet_transactions enable row level security;
alter table public.wallet_sync_state   enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='wallet_transactions' and policyname='auth_select_wallet_tx'
  ) then
    create policy auth_select_wallet_tx
      on public.wallet_transactions for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='wallet_transactions' and policyname='auth_insert_wallet_tx'
  ) then
    create policy auth_insert_wallet_tx
      on public.wallet_transactions for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='wallet_sync_state' and policyname='auth_select_wallet_sync'
  ) then
    create policy auth_select_wallet_sync
      on public.wallet_sync_state for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='wallet_sync_state' and policyname='auth_upsert_wallet_sync'
  ) then
    create policy auth_upsert_wallet_sync
      on public.wallet_sync_state for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ逕ｨ
create index if not exists idx_wallet_tx_user_ts on public.wallet_transactions (user_id, timestamp desc);


-- File: 20251201_create_exchange_trades.sql
CREATE TABLE IF NOT EXISTS public.exchange_trades (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exchange TEXT NOT NULL,
    trade_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    price NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    fee NUMERIC,
    fee_asset TEXT,
    ts TIMESTAMPTZ NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, exchange, trade_id)
);


-- File: 20240523100000_create_daily_exchange_rates.sql

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



-- File: 20251007_companies_clients_min.sql
-- =========================================================
-- Companies / Clients (minimal) + invoices 縺ｸ縺ｮ蛻苓ｿｽ蜉 + RLS
-- 蟇ｾ雎｡: Supabase SQL Editor 縺ｧ螳溯｡・
-- 譌｢蟄倥・繧ｹ繧ｭ繝ｼ繝槭ｄ繝昴Μ繧ｷ繝ｼ繧貞｣翫＆縺ｪ縺・ｈ縺・↓菴懈・鬆・蟄伜惠繝√ぉ繝・け繧帝・諷ｮ
-- =========================================================

-- 0) 萓晏ｭ俶僑蠑ｵ・・upabase 縺ｧ縺ｯ騾壼ｸｸ譛牙柑縺縺悟ｿｵ縺ｮ縺溘ａ・・
create extension if not exists pgcrypto;

-- 1) 繝・・繝悶Ν菴懈・ -----------------------------------------------------------
-- 莨夂､ｾ・・our company・・
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  address    text,
  country    text,
  tax_id     text,
  created_at timestamptz default now()
);

-- 繧ｯ繝ｩ繧､繧｢繝ｳ繝茨ｼ・our client・・
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  address    text,
  country    text,
  email      text,
  created_at timestamptz default now()
);

-- 2) invoices 縺ｫ荳崎ｶｳ繧ｫ繝ｩ繝繧定ｿｽ蜉・域里蟄倥・蛻励・邯ｭ謖・ｼ・---------------------------
-- 迴ｾ蝨ｨ縺ｮ Billing.tsx 縺・customer_name 繧・insert 縺励※縺・ｋ縺溘ａ霑ｽ蜉縺励※謨ｴ蜷・
alter table public.invoices
  add column if not exists customer_name text,
  add column if not exists company_id    uuid references public.companies(id) on delete set null,
  add column if not exists client_id     uuid references public.clients(id)    on delete set null;

-- 3) RLS 譛牙柑蛹・--------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.clients  enable row level security;

-- 4) RLS 繝昴Μ繧ｷ繝ｼ・磯㍾隍・ｒ驕ｿ縺代ｋ縺溘ａ DROP 蠕後↓ CREATE・・----------------------
-- companies
drop policy if exists allow_user_manage_companies on public.companies;
create policy allow_user_manage_companies
  on public.companies
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- clients
drop policy if exists allow_user_manage_clients on public.clients;
create policy allow_user_manage_clients
  on public.clients
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5) 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ陬懷勧 ------------------------------------------------------
create index if not exists idx_companies_user_id on public.companies(user_id);
create index if not exists idx_clients_user_id   on public.clients(user_id);

-- =========================================================
-- 遒ｺ隱咲畑・亥ｿ・ｦ√↓蠢懊§縺ｦ蛟句挨螳溯｡鯉ｼ・
-- select tablename, rls_enabled
--   from pg_tables
--  where schemaname='public' and tablename in ('companies','clients');
--
-- select schemaname, tablename, policyname, cmd, roles
--   from pg_policies
--  where tablename in ('companies','clients')
--  order by tablename, policyname;
--
-- \d+ public.invoices   -- 霑ｽ蜉蛻励・遒ｺ隱搾ｼ・ustomer_name / company_id / client_id・・
-- =========================================================


-- File: 20251007_transfers.sql
-- =========================================================
-- transfers: 騾・≡險倬鹸 + clients.wallet 霑ｽ蜉・域怙蟆乗僑蠑ｵ・・ RLS
-- =========================================================

create extension if not exists pgcrypto;

-- 譌｢蟄・clients 縺ｫ wallet 繧ｫ繝ｩ繝・育┌縺代ｌ縺ｰ・・
alter table public.clients
  add column if not exists wallet text;

-- 騾・≡險倬鹸繝・・繝悶Ν
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  wallet_address text not null,
  amount numeric not null,
  currency text default 'ETH',
  tx_hash text,                  -- on-chain 繝医Λ繝ｳ繧ｶ繧ｯ繧ｷ繝ｧ繝ｳ繝上ャ繧ｷ繝･
  status text default 'pending', -- pending | success | failed
  created_at timestamptz default now()
);

-- RLS
alter table public.transfers enable row level security;

drop policy if exists allow_user_manage_transfers on public.transfers;

create policy allow_user_manage_transfers
  on public.transfers
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 陬懷勧繧､繝ｳ繝・ャ繧ｯ繧ｹ
create index if not exists idx_transfers_user_id on public.transfers(user_id);
create index if not exists idx_transfers_client_id on public.transfers(client_id);


-- File: 20251030_ledger_base.sql
-- 蝓ｺ譛ｬ繝槭せ繧ｿ・夂畑騾斐き繝・ざ繝ｪ・・FRS貅匁侠縺ｮ謇ｱ縺・Γ繝｢莉倥″・・
create table if not exists public.usage_categories (
  key text primary key,
  ifrs_standard text,
  description text
);

insert into public.usage_categories(key, ifrs_standard, description) values
('investment','IAS38','荳闊ｬ菫晄怏・育┌蠖｢雉・肇縲√さ繧ｹ繝医Δ繝・Ν縺ｮ縺ｿ・・),
('impairment','IAS36','貂帶錐・・AS38繧ｳ繧ｹ繝医Δ繝・Ν蜑肴署・・),
('inventory_trader','IAS2','騾壼ｸｸ縺ｮ譽壼査・・CNRV・・),
('inventory_broker','IAS2','繝悶Ο繝ｼ繧ｫ繝ｼ迚ｹ萓具ｼ・VLCS・・),
('ifrs15_non_cash','IFRS15','髱樒樟驥大ｯｾ萓｡・亥ｾ梧律隲区ｱらｮ｡逅・→騾｣謳ｺ・・),
('mining','Conceptual','繝槭う繝九Φ繧ｰ蝣ｱ驟ｬ'),
('staking','Conceptual','繧ｹ繝・・繧ｭ繝ｳ繧ｰ蝣ｱ驟ｬ'),
('disposal_sale','IAS38','螢ｲ蜊ｴ/髯､蜊ｴ')
on conflict (key) do nothing;

-- TX縺ｸ縺ｮ逕ｨ騾斐Λ繝吶Ν・井ｺ域ｸｬ・・｢ｺ螳夲ｼ・
create table if not exists public.transaction_usage_labels (
  id uuid primary key default gen_random_uuid(),
  tx_id bigint not null references public.wallet_transactions(id) on delete cascade,
  user_id uuid not null,
  predicted_key text references public.usage_categories(key),
  confirmed_key text references public.usage_categories(key),
  confidence numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tx_usage_user_tx on public.transaction_usage_labels(user_id, tx_id);

-- 莉戊ｨｳ繝倥ャ繝
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tx_id bigint,
  entry_date timestamptz not null,
  source text not null default 'auto', -- auto|manual
  usage_key text references public.usage_categories(key),
  memo text,
  created_at timestamptz default now()
);

-- 莉戊ｨｳ譏守ｴｰ・井ｺ碁㍾莉戊ｨｳ・・
create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_code text not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  meta jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_jlines_entry on public.journal_lines(entry_id);

-- RLS・・rofiles縺ｨ蜷檎ｭ峨・譁ｹ驥昴〒繝ｦ繝ｼ繧ｶ繝ｼ邵帙ｊ・・
alter table public.transaction_usage_labels enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='tx_usage_select_owner') then
    create policy tx_usage_select_owner on public.transaction_usage_labels
    for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname='tx_usage_ins_owner') then
    create policy tx_usage_ins_owner on public.transaction_usage_labels
    for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname='tx_usage_upd_owner') then
    create policy tx_usage_upd_owner on public.transaction_usage_labels
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname='je_select_owner') then
    create policy je_select_owner on public.journal_entries
    for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname='je_ins_owner') then
    create policy je_ins_owner on public.journal_entries
    for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname='je_upd_owner') then
    create policy je_upd_owner on public.journal_entries
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname='jl_select_owner') then
    create policy jl_select_owner on public.journal_lines
    for select using (
      exists (select 1 from public.journal_entries je
              where je.id = entry_id and je.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='jl_ins_owner') then
    create policy jl_ins_owner on public.journal_lines
    for insert with check (
      exists (select 1 from public.journal_entries je
              where je.id = entry_id and je.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='jl_upd_owner') then
    create policy jl_upd_owner on public.journal_lines
    for update using (
      exists (select 1 from public.journal_entries je
              where je.id = entry_id and je.user_id = auth.uid())
    ) with check (
      exists (select 1 from public.journal_entries je
              where je.id = entry_id and je.user_id = auth.uid())
    );
  end if;
end $$;


-- File: 20251104_payment_gateway_vault.sql
-- supabase/migrations/20251104_payment_gateway_vault.sql
-- Merchant vault addresses (per network)
create table if not exists public.payment_vault_addresses (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  network text not null,  -- Polygon / Ethereum / Arbitrum / Base
  asset text not null,    -- USDC / USDT / ETH / MATIC
  address text not null,  -- merchant's receiving address
  created_at timestamptz default now(),
  unique (user_id, network, asset)
);

alter table public.payment_vault_addresses enable row level security;

drop policy if exists vault_select_own on public.payment_vault_addresses;
drop policy if exists vault_ins_own on public.payment_vault_addresses;
drop policy if exists vault_upd_own on public.payment_vault_addresses;

create policy vault_select_own
  on public.payment_vault_addresses
  for select
  to authenticated
  using (user_id = auth.uid());

create policy vault_ins_own
  on public.payment_vault_addresses
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy vault_upd_own
  on public.payment_vault_addresses
  for update
  to authenticated
  using (user_id = auth.uid());


-- File: 20251031_create_transaction_usage_labels.sql
-- 逕ｨ騾斐Λ繝吶Ν・医Θ繝ｼ繧ｶ繝ｼ縺梧焔蜍輔〒驕ｸ縺ｶ譛邨ら｢ｺ螳壹Λ繝吶Ν・・
create table if not exists public.transaction_usage_labels (
  -- 繧｢繝励Μ縺ｮ隱崎ｨｼ繝ｦ繝ｼ繧ｶ繝ｼ
  user_id uuid not null,
  -- 縺ｩ縺ｮ蜿門ｼ輔↓蟇ｾ縺吶ｋ繝ｩ繝吶Ν縺具ｼ医≠縺ｪ縺溘・螳溯｣・〒縺ｯ wallet_transactions.id 繧呈治逕ｨ・・
  tx_id   bigint not null references public.wallet_transactions(id) on delete cascade,

  -- 繝ｩ繝吶Ν蛟､・亥ｿ・ｦ√↓蠢懊§縺ｦ霑ｽ蜉OK・・
  label text not null check (
    label in (
      'revenue','expense','transfer','investment','airdrop','payment','fee','internal','other'
    )
  ),

  -- 莠亥ｙ・壽立螳溯｣・〒 ctx_id 繧貞盾辣ｧ縺励※縺・◆蜿ｯ閭ｽ諤ｧ縺ｫ蛯吶∴繧具ｼ・ULL蜿ｯ・・
  ctx_id bigint null,

  updated_at timestamptz not null default now(),

  -- 繝ｦ繝九・繧ｯ・壼酔縺倥Θ繝ｼ繧ｶ繝ｼ縺悟酔縺伜叙蠑輔↓隍・焚蝗樔ｻ倥￠繧峨ｌ縺ｪ縺・ｈ縺・↓
  constraint transaction_usage_labels_unique_tx unique (user_id, tx_id),

  -- 譌ｧUI縺・ctx_id 縺ｧ upsert 縺励※縺・※繧ゆｸ諢上↓縺ｪ繧九ｈ縺・↓・・tx_id 蛻ｩ逕ｨ譎ゅ・縺ｿ譛牙柑・・
  constraint transaction_usage_labels_unique_ctx unique (user_id, ctx_id)
);

-- RLS
alter table public.transaction_usage_labels enable row level security;

-- 閾ｪ蛻・・陦後□縺題ｪｭ繧√ｋ/譖ｸ縺代ｋ
drop policy if exists "labels_select_own" on public.transaction_usage_labels;
create policy "labels_select_own"
  on public.transaction_usage_labels
  for select
  using (auth.uid() = user_id);

drop policy if exists "labels_upsert_own" on public.transaction_usage_labels;
create policy "labels_upsert_own"
  on public.transaction_usage_labels
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "labels_update_own" on public.transaction_usage_labels;
create policy "labels_update_own"
  on public.transaction_usage_labels
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "labels_delete_own" on public.transaction_usage_labels;
create policy "labels_delete_own"
  on public.transaction_usage_labels
  for delete
  using (auth.uid() = user_id);

-- 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ
create index if not exists idx_transaction_usage_labels_user_tx
  on public.transaction_usage_labels (user_id, tx_id);

create index if not exists idx_transaction_usage_labels_user_ctx
  on public.transaction_usage_labels (user_id, ctx_id);


-- File: 20251031_create_transaction_usage_predictions.sql
-- 逕ｨ騾斐・讖滓｢ｰ謗ｨ螳夲ｼ医ヲ繝ｳ繝医→縺励※菫晄戟・峨よ焔蜍慕｢ｺ螳壹・ transaction_usage_labels 蛛ｴ
create table if not exists public.transaction_usage_predictions (
  user_id uuid not null,
  tx_id   bigint not null references public.wallet_transactions(id) on delete cascade,
  model   text not null default 'rule',
  label   text not null,
  score   numeric(6,5) not null default 1.0,
  created_at timestamptz not null default now(),
  primary key (user_id, tx_id, model)
);

alter table public.transaction_usage_predictions enable row level security;

drop policy if exists "pred_select_own" on public.transaction_usage_predictions;
create policy "pred_select_own"
  on public.transaction_usage_predictions
  for select
  using (auth.uid() = user_id);

drop policy if exists "pred_upsert_own" on public.transaction_usage_predictions;
create policy "pred_upsert_own"
  on public.transaction_usage_predictions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "pred_update_own" on public.transaction_usage_predictions;
create policy "pred_update_own"
  on public.transaction_usage_predictions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- File: 20240524100000_add_usage_and_note.sql

-- Add accounting-related columns `usage` and `note` to the source transaction tables.

-- Add usage and note columns to exchange_trades
ALTER TABLE public.exchange_trades
ADD COLUMN IF NOT EXISTS usage TEXT,
ADD COLUMN IF NOT EXISTS note TEXT;

-- Add usage and note columns to wallet_transactions
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS usage TEXT,
ADD COLUMN IF NOT EXISTS note TEXT;


-- File: 20250923125816_4d6d036c-074e-427a-b978-cfd58c246127.sql
-- Add tax_country and entity_type columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tax_country TEXT,
ADD COLUMN entity_type TEXT;


-- File: 20250926042141_25020edf-41da-4ecc-a710-4c2a52b7239e.sql
-- Add wallet verification tracking to wallet_connections table
ALTER TABLE public.wallet_connections 
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS verification_signature text;


-- File: 20250928134321_2f77901e-d8af-44c6-9b74-3a778a7872ee.sql
-- Update transactions table to match standardized schema
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS chain_id INTEGER,
ADD COLUMN IF NOT EXISTS network TEXT,
ADD COLUMN IF NOT EXISTS log_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('in', 'out', 'self')),
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('native', 'erc20', 'erc721', 'erc1155', 'swap', 'bridge', 'fee', 'other')),
ADD COLUMN IF NOT EXISTS asset_contract TEXT,
ADD COLUMN IF NOT EXISTS asset_symbol TEXT,
ADD COLUMN IF NOT EXISTS asset_decimals INTEGER,
ADD COLUMN IF NOT EXISTS fee_native NUMERIC,
ADD COLUMN IF NOT EXISTS usd_value_at_tx NUMERIC,
ADD COLUMN IF NOT EXISTS usd_fee_at_tx NUMERIC,
ADD COLUMN IF NOT EXISTS price_source TEXT,
ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMPTZ DEFAULT now();

-- Update existing columns to match schema
ALTER TABLE public.transactions 
ALTER COLUMN blockchain_network SET NOT NULL,
ALTER COLUMN transaction_hash SET NOT NULL;

-- Add unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique 
ON public.transactions (chain_id, transaction_hash, log_index);

-- Add composite index for user queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_time 
ON public.transactions (user_id, transaction_date DESC);

-- Add index for chain queries
CREATE INDEX IF NOT EXISTS idx_transactions_chain 
ON public.transactions (chain_id);

-- Add index for network queries  
CREATE INDEX IF NOT EXISTS idx_transactions_network 
ON public.transactions (network);

-- Update wallet_connections to track sync status per chain
ALTER TABLE public.wallet_connections
ADD COLUMN IF NOT EXISTS chain_last_synced_at JSONB DEFAULT '{}';

-- Add environment secrets placeholders (will need to be set manually)
-- ALCHEMY_API_KEY, COVALENT_API_KEY, COINGECKO_API_BASE will be added as secrets


-- File: 20250929_add_unique_idx_transactions.sql
-- user_profiles: 1繝ｦ繝ｼ繧ｶ繝ｼ=1繝励Ο繝輔ぅ繝ｼ繝ｫ
create unique index if not exists ux_user_profiles_user
  on public.user_profiles (user_id);

-- user_tax_settings: 1繝ｦ繝ｼ繧ｶ繝ｼ=1遞主漁險ｭ螳・
create unique index if not exists ux_user_tax_settings_user
  on public.user_tax_settings (user_id);


-- File: 20251001_rls_policies.sql
-- supabase/migrations/20251001_rls_policies.sql

-- 譛牙柑蛹厄ｼ壼ｯｾ雎｡繝・・繝悶Ν
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 蜈ｱ騾・ 繝ｭ繧ｰ繧､繝ｳ貂医∩繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ縺ｿ
CREATE POLICY "allow_authenticated_select_profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_upsert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- wallet_connections
CREATE POLICY "allow_user_select_wallets"
  ON public.wallet_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_user_modify_wallets"
  ON public.wallet_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_user_update_wallets"
  ON public.wallet_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- transactions・郁ｪｭ縺ｿ蜿悶ｊ縺ｯ譛ｬ莠ｺ縺ｮ縺ｿ縲よ嶌縺崎ｾｼ縺ｿ縺ｯEdge Function邨檎罰繧呈Φ螳夲ｼ・
CREATE POLICY "allow_user_select_transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- invoices
CREATE POLICY "allow_user_select_invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_user_modify_invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_user_update_invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- customers
CREATE POLICY "allow_user_select_customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_user_modify_customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_user_update_customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- crypto_payments・郁ｪｭ縺ｿ蜿悶ｊ縺ｯ譛ｬ莠ｺ縺ｮ縺ｿ縲る・≡螳溯｡後・Edge Function縺ｮService Role縺ｧ・・
CREATE POLICY "allow_user_select_crypto_payments"
  ON public.crypto_payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- File: 20251007_wallet_linking.sql
-- 繝励Ο繝輔ぃ繧､繝ｫ縺ｫ primary_wallet 縺ｨ verify_nonce 繧定ｿｽ蜉・医↑縺代ｌ縺ｰ・・
alter table public.profiles
  add column if not exists primary_wallet text,
  add column if not exists verify_nonce text;

-- 鄂ｲ蜷肴､懆ｨｼ繝ｻ菫晏ｭ倥・繝ｦ繝ｼ繧ｶ繝ｼ譛ｬ莠ｺ縺ｮ縺ｿ・・LS縺梧里縺ｫon縺ｮ蜑肴署・・
-- 譌｢蟄倥・RLS繝昴Μ繧ｷ繝ｼ・・ser_id = auth.uid()・峨′讖溯・縺励※縺・ｌ縺ｰ譁ｰ隕剰ｿｽ蜉荳崎ｦ・
-- 蠢ｵ縺ｮ縺溘ａ profiles 縺ｮ auth 繝昴Μ繧ｷ繝ｼ縺後≠繧九°遒ｺ隱阪＠縲∫┌縺代ｌ縺ｰ霑ｽ蜉縺励※縺上□縺輔＞・井ｾ具ｼ・
-- create policy if not exists allow_update_own_profile
--   on public.profiles
--   for update to authenticated
--   using (user_id = auth.uid())
--   with check (user_id = auth.uid());


-- File: 20251009_add_wallet_columns.sql
-- profiles 縺ｫ繧ｦ繧ｩ繝ｬ繝・ヨ邏蝉ｻ倥￠逕ｨ縺ｮ蛻励ｒ霑ｽ蜉・亥ｭ伜惠縺励↑縺代ｌ縺ｰ・・
alter table public.profiles
  add column if not exists primary_wallet text,
  add column if not exists verify_nonce  text;

-- 縺吶〒縺ｫ RLS 縺ｯ user_id = auth.uid() 縺ｧ菫晁ｭｷ縺輔ｌ縺ｦ縺・ｋ蜑肴署縲・
-- 繧ゅ＠ update 繝昴Μ繧ｷ繝ｼ縺檎┌縺・ｴ蜷医・縺ｿ縲∽ｻ･荳九ｒ菴ｿ縺｣縺ｦ縺上□縺輔＞縲・
-- create policy if not exists allow_update_own_profile
--   on public.profiles
--   for update to authenticated
--   using (user_id = auth.uid())
--   with check (user_id = auth.uid());


-- File: 20251029_probe_profiles_region.sql
-- 1) profiles 縺ｮ繧ｫ繝ｩ繝荳隕ｧ・・egion 縺檎┌縺・°繧堤｢ｺ隱搾ｼ・
select attname as column_name, atttypid::regtype as data_type
from pg_attribute
where attrelid = 'public.profiles'::regclass
  and attnum > 0 and not attisdropped
order by attnum;

-- 2) profiles 縺ｫ縺ｶ繧我ｸ九′繧九ヨ繝ｪ繧ｬ荳隕ｧ
select t.tgname as trigger_name,
       t.tgenabled,
       pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
where t.tgrelid = 'public.profiles'::regclass
  and not t.tgisinternal
order by t.tgname;

-- 3) 繝医Μ繧ｬ縺ｧ蜻ｼ縺ｰ繧後ｋ髢｢謨ｰ縺ｮ譛ｬ菴難ｼ・egion 繧貞盾辣ｧ縺励※縺・↑縺・°繝√ぉ繝・け・・
--   窶ｻ 髢｢謨ｰ蜷阪・荳翫・邨先棡縺ｮ "EXECUTE FUNCTION schema.fn(...)" 縺九ｉ諡ｾ縺｣縺ｦ縺上□縺輔＞
--   縺ｾ縺壹・ "profiles" 繧貞盾辣ｧ縺吶ｋ髢｢謨ｰ蛟呵｣懊ｒ荳諡ｬ縺ｧ繧ｵ繝ｼ繝・
select n.nspname as schema,
       p.proname as function_name,
       pg_get_functiondef(p.oid) as function_ddl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where pg_get_functiondef(p.oid) ilike '%profiles%'
   or pg_get_functiondef(p.oid) ilike '% NEW.%'
   or pg_get_functiondef(p.oid) ilike '%region%';

-- 4) 逕滓・蛻・DEFAULT 縺ｫ 'region' 繧貞盾辣ｧ縺励※縺・↑縺・°・郁ｨ育ｮ怜・縺ｮ譛臥┌・・
select c.relname as table_name, a.attname as column_name, d.adsrc as default_expr
from pg_attrdef d
join pg_class c on c.oid = d.adrelid
join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
where c.relname = 'profiles'
  and d.adsrc ilike '%region%';

-- 5) 繝薙Η繝ｼ/繝ｫ繝ｼ繝ｫ縺ｧ region 繧貞盾辣ｧ縺励※縺・↑縺・°・亥ｿｵ縺ｮ縺溘ａ・・
select viewname, definition
from pg_views
where schemaname='public' and definition ilike '%region%'
order by viewname;


-- File: 20251029_profiles_policies.sql
-- Enable RLS if not enabled
alter table public.profiles enable row level security;

-- Safety: ensure user_id is unique (prevent duplicates)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'profiles_user_id_key'
  ) then
    alter table public.profiles add constraint profiles_user_id_key unique (user_id);
  end if;
end $$;

-- Optional: align id with user_id automatically on insert (keeps both equal)
-- If you already manage id=freshUser.id from app, you can skip this trigger.
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'profiles_align_ids'
  ) then
    create or replace function public.profiles_align_ids()
    returns trigger
    language plpgsql
    as $fn$
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
    $fn$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_profiles_align_ids'
  ) then
    create trigger trg_profiles_align_ids
    before insert on public.profiles
    for each row execute procedure public.profiles_align_ids();
  end if;
end $$;

-- Clear existing policies (optional, only if you know existing ones are wrong)
-- drop policy if exists ...  -- (skip for safety in production)

-- SELECT policy: owner-only
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'profiles_select_owner_only'
  ) then
    create policy profiles_select_owner_only
    on public.profiles
    for select
    using (user_id = auth.uid());
  end if;
end $$;

-- INSERT policy: only self row, must satisfy WITH CHECK
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'profiles_insert_self_only'
  ) then
    create policy profiles_insert_self_only
    on public.profiles
    for insert
    with check (user_id = auth.uid());
  end if;
end $$;

-- UPDATE policy: only self row
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'profiles_update_owner_only'
  ) then
    create policy profiles_update_owner_only
    on public.profiles
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;
end $$;


-- File: 20251110_create_v_all_transactions.sql
-- v_all_transactions FINAL & COMPLETE: Uses 'wallet_connections' to identify internal transfers.
-- This version rebuilds the view to correctly categorize internal vs external transactions.

DROP VIEW IF EXISTS public.v_all_transactions CASCADE;

CREATE OR REPLACE VIEW public.v_all_transactions AS
WITH
-- Step 1: 縺疲欠鞫倥・騾壹ｊ 'wallet_connections' 繝・・繝悶Ν縺九ｉ繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ蜈ｨ繧｢繝峨Ξ繧ｹ繝ｪ繧ｹ繝医ｒ菴懈・
user_addresses AS (
  SELECT user_id, wallet_address AS address FROM public.wallet_connections
),

-- Step 2: 繧ｪ繝ｳ繝√ぉ繝ｼ繝ｳ蜿門ｼ輔ｒ蛻・｡・
onchain_txs AS (
  SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'UNKNOWN_ASSET') AS asset,
    t.chain_id::text AS chain,
    -- 蜿門ｼ慕嶌謇九′繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ騾｣謳ｺ貂医∩繧ｦ繧ｩ繝ｬ繝・ヨ縺ｮ蝣ｴ蜷・'internal_transfer' 縺ｫ蛻・｡・
    CASE
      WHEN t.direction = 'in' AND t.from_address IN (SELECT address FROM user_addresses ua WHERE ua.user_id = t.user_id) THEN 'internal_transfer'
      WHEN t.direction = 'out' AND t.to_address IN (SELECT address FROM user_addresses ua WHERE ua.user_id = t.user_id) THEN 'internal_transfer'
      ELSE t.direction -- 縺昴ｌ莉･螟悶・逵溘・縲悟・驥・in)縲阪∪縺溘・縲碁・≡(out)縲・
    END AS type
  FROM
    public.wallet_transactions t
),

-- Step 3: 蜿門ｼ墓園縺ｮ蜿門ｼ輔ｒ蛻・｡・
exchange_txs AS (
  -- Section A: 豕募ｮ夐夊ｲｨ縺ｨ縺ｮ螢ｲ雋ｷ
  SELECT
    et.trade_id::text AS id, et.user_id, et.trade_id::text AS reference_id, et.ts AS date,
    (et.raw_data->>'obtainAmount')::numeric AS amount,
    (et.raw_data->>'cryptoCurrency') AS asset,
    et.exchange AS chain,
    CASE
      WHEN et.raw_data->>'transactionType' = '0' THEN 'buy'
      WHEN et.raw_data->>'transactionType' = '1' THEN 'sell'
      ELSE 'unknown'
    END AS type,
    (et.raw_data->>'sourceAmount')::numeric AS acquisition_price_total,
    (et.raw_data->>'fiatCurrency') AS quote_asset
  FROM public.exchange_trades et
  WHERE et.symbol LIKE '%/%'
  UNION ALL
  -- Section B: 證怜捷雉・肇縺ｮ蜃ｺ驥・
  SELECT
    et.trade_id::text, et.user_id, et.trade_id::text, et.ts,
    et.amount, et.symbol, et.exchange,
    -- 蜃ｺ驥大・縺後Θ繝ｼ繧ｶ繝ｼ縺ｮ騾｣謳ｺ貂医∩繧ｦ繧ｩ繝ｬ繝・ヨ縺ｮ蝣ｴ蜷・'internal_transfer' 縺ｫ蛻・｡・
    CASE
      WHEN (et.raw_data->>'address') IN (SELECT address FROM user_addresses ua WHERE ua.user_id = et.user_id) THEN 'internal_transfer'
      ELSE 'OUT' -- 縺昴ｌ莉･螟悶・逵溘・縲悟､夜Κ蜃ｺ驥・OUT)縲・
    END AS type,
    NULL::numeric, NULL
  FROM public.exchange_trades et
  WHERE et.side = 'withdrawal'
)

-- Final Step: 蜈ｨ縺ｦ縺ｮ蛻・｡樊ｸ医∩蜿門ｼ輔ｒ邨仙粋縺励※譛邨ゅン繝･繝ｼ繧剃ｽ懈・
SELECT
    id, user_id, reference_id, date,
    type || ' ' || amount::text || ' ' || asset AS description,
    amount, asset,
    (SELECT quote_asset FROM exchange_txs etx WHERE etx.id = all_txs.id) as quote_asset,
    CASE
        WHEN type = 'buy' OR type = 'sell' THEN (SELECT acquisition_price_total FROM exchange_txs etx WHERE etx.id = all_txs.id) / amount
        ELSE NULL
    END AS price,
    (SELECT acquisition_price_total FROM exchange_txs etx WHERE etx.id = all_txs.id) as acquisition_price_total,
    type,
    CASE WHEN chain ~ '^[0-9\.]+$' THEN 'on-chain' ELSE 'exchange' END AS source,
    chain
FROM (
    SELECT id, user_id, reference_id, date, amount, asset, chain, type, NULL::numeric as acquisition_price_total, NULL as quote_asset FROM onchain_txs
    UNION ALL
    SELECT id, user_id, reference_id, date, amount, asset, chain, type, acquisition_price_total, quote_asset FROM exchange_txs
) AS all_txs;


-- File: 20251202_add_usd_value_to_view.sql
-- supabase/migrations/20251202_add_usd_value_to_view.sql
DROP VIEW IF EXISTS public.v_all_transactions;

CREATE OR REPLACE VIEW public.v_all_transactions AS
-- Wallet Transactions (final schema)
SELECT
  w.user_id,
  'wallet'::text AS source,
  w.id::text AS source_id,
  w.tx_hash,
  w.timestamp AS ts,
  w.chain_id::text AS chain,
  (CASE w.direction WHEN 'out' THEN -1 ELSE 1 END) * w.value_wei AS amount,
  w.asset_symbol AS asset,
  NULL::text AS exchange,
  NULL::text AS symbol,
  w.usd_value_at_tx AS value_usd
FROM
  public.wallet_transactions w

UNION ALL

-- Exchange Trades (robust JSON extraction)
SELECT
  e.user_id,
  'exchange'::text AS source,
  (e.raw_data->>'id') AS source_id,
  (e.raw_data->>'id') AS tx_hash,
  to_timestamp((e.raw_data->>'timestamp')::bigint / 1000.0) AS ts,
  NULL::text AS chain,
  (CASE LOWER(e.raw_data->>'side') WHEN 'sell' THEN -1 ELSE 1 END) * (e.raw_data->>'amount')::numeric AS amount,
  split_part((e.raw_data->>'symbol'), '/', 1) AS asset,
  e.exchange,
  (e.raw_data->>'symbol') as symbol,
  (e.raw_data->>'cost')::numeric AS value_usd
FROM
  public.exchange_trades e;


-- File: 20251203_add_usd_column.sql
-- supabase/migrations/20251203_add_usd_column.sql
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS usd_value_at_tx NUMERIC;


-- File: 20251204_add_connection_name.sql
-- supabase/migrations/20251204_add_connection_name.sql

-- 繝ｦ繝ｼ繧ｶ繝ｼ縺梧磁邯壹↓蜷榊燕繧剃ｻ倥￠繧峨ｌ繧九ｈ縺・↓縲∵眠縺励＞繧ｫ繝ｩ繝繧定ｿｽ蜉縺励∪縺吶・
ALTER TABLE public.exchange_connections
ADD COLUMN IF NOT EXISTS connection_name TEXT;

-- 譌｢蟄倥・繝・・繧ｿ縺ｫ繝・ヵ繧ｩ繝ｫ繝亥錐繧定ｨｭ螳壹＠縺ｾ縺呻ｼ亥叙蠑墓園蜷阪ｒ縺昴・縺ｾ縺ｾ菴ｿ逕ｨ・峨・
UPDATE public.exchange_connections
SET connection_name = exchange
WHERE connection_name IS NULL;

-- 莉雁ｾ後√％縺ｮ蜷榊燕縺ｯ蠢・磯・岼縺ｨ縺励∪縺吶・
ALTER TABLE public.exchange_connections
ALTER COLUMN connection_name SET NOT NULL;

-- 縺薙ｌ縺ｾ縺ｧ縺ｮ縲後Θ繝ｼ繧ｶ繝ｼ縺斐→縲∝叙蠑墓園縺斐→縲阪・驥崎､・ｦ∵ｭ｢繝ｫ繝ｼ繝ｫ繧貞炎髯､縺励∪縺吶・
-- 豕ｨ諢・ 縺薙・蛻ｶ邏・錐縺ｯ迺ｰ蠅・↓繧医▲縺ｦ逡ｰ縺ｪ繧句ｴ蜷医′縺ゅｊ縺ｾ縺吶ゅお繝ｩ繝ｼ縺悟・繧句ｴ蜷医・縲ヾupabase繝繝・す繝･繝懊・繝峨°繧画焔蜍輔〒蜑企勁縺励※縺上□縺輔＞縲・
ALTER TABLE public.exchange_connections DROP CONSTRAINT IF EXISTS exchange_connections_user_id_exchange_key;

-- 譁ｰ縺励￥縲後Θ繝ｼ繧ｶ繝ｼ縺斐→縲∵磁邯壼錐縺斐→縲阪・驥崎､・ｦ∵ｭ｢繝ｫ繝ｼ繝ｫ繧定ｨｭ螳壹＠縺ｾ縺吶・
-- 縺薙ｌ縺ｫ繧医ｊ縲√Θ繝ｼ繧ｶ繝ｼ縺ｯ蜷後§蜷榊燕縺ｮ謗･邯壹ｒ隍・焚菴懈・縺ｧ縺阪↑縺上↑繧翫∪縺吶・
ALTER TABLE public.exchange_connections
ADD CONSTRAINT unique_user_connection_name UNIQUE (user_id, connection_name);


-- File: 20251205_add_encrypted_blob_column.sql
-- supabase/migrations/20251205_add_encrypted_blob_column.sql

ALTER TABLE public.exchange_connections
ADD COLUMN IF NOT EXISTS encrypted_blob TEXT;


-- File: 20251205_create_cash_flow_view.sql
-- supabase/migrations/20251205_create_cash_flow_view.sql
-- PURPOSE: Creates the view for the Cash Flow Statement.

CREATE OR REPLACE VIEW public.v_cash_flow_statement AS
SELECT
    t.user_id,
    -- Operating Activities
    SUM(CASE WHEN t.usage = 'trading_acquisition_ias2' THEN -t.value_in_usd ELSE 0 END) AS cash_out_for_inventory,
    SUM(CASE WHEN t.usage = 'sale_ias2' THEN t.value_in_usd ELSE 0 END) AS cash_in_from_inventory_sales,
    SUM(CASE WHEN t.usage = 'revenue_ifrs15' THEN t.value_in_usd ELSE 0 END) AS cash_in_from_revenue,
    SUM(CASE WHEN t.usage = 'gas_fees' THEN -t.value_in_usd ELSE 0 END) AS cash_out_for_gas_fees,

    -- Investing Activities
    SUM(CASE WHEN t.usage = 'investment_acquisition_ias38' THEN -t.value_in_usd ELSE 0 END) AS cash_out_for_intangibles,
    SUM(CASE WHEN t.usage = 'sale_ias38' THEN t.value_in_usd ELSE 0 END) AS cash_in_from_intangibles,

    -- Financing Activities (Note: No direct financing activities modeled yet)
    SUM(CASE WHEN t.usage = 'capital_contribution' THEN t.value_in_usd ELSE 0 END) AS cash_in_from_financing,
    SUM(CASE WHEN t.usage = 'distribution_to_owners' THEN -t.value_in_usd ELSE 0 END) AS cash_out_to_owners

FROM public.all_transactions t
WHERE t.usage IS NOT NULL
GROUP BY t.user_id;


-- File: 20251206_create_all_transactions_view.sql
-- supabase/migrations/20251206_create_all_transactions_view.sql
-- PURPOSE: Unified view of all transactions with normalized asset fields.

-- Drop the view if it exists for a clean rebuild
DROP VIEW IF EXISTS public.all_transactions;

-- This final, consolidated view is the single source of truth, conforming to our customer's actual schema (with disparate ID types)
CREATE OR REPLACE VIEW public.all_transactions AS

-- =================================================================
-- On-chain Transactions (FROM: public.wallet_transactions)
-- =================================================================
SELECT
    t.id::text, -- [Critical Fix] Cast UUID to TEXT
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset, -- This is the base asset
    NULL AS quote_asset, -- No quote asset for on-chain tx
    NULL AS price,       -- No price for on-chain tx
    t.direction AS type, -- 'IN' or 'OUT'
    'on-chain' as source,
    t.chain_id::text AS chain
FROM
    public.wallet_transactions t

UNION ALL

-- =================================================================
-- Exchange Trades (FROM: public.exchange_trades)
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,
    et.amount,
    split_part(et.symbol, '/', 1) AS asset,      -- Base asset (e.g., BTC)
    split_part(et.symbol, '/', 2) AS quote_asset, -- Quote asset (e.g., USD)
    et.price,
    et.side AS type, -- 'buy' or 'sell'
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et;


-- File: 20251209_create_final_holdings_view.sql
-- v_holdings FINAL v4: Excludes 'internal_transfer' from calculations

CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- Step 1: 髱咏噪縺ｪ迴ｾ蝨ｨ萓｡譬ｼ繝ｪ繧ｹ繝・
current_prices (asset, price_jpy) AS (
  VALUES
    ('BTC', 10000000),
    ('ETH', 500000)
),
-- Step 2: 蜈ｨ縺ｦ縺ｮ蜿門ｼ輔ｒ髮・ｨ茨ｼ医◆縺縺・internal_transfer 縺ｯ辟｡隕悶☆繧具ｼ・
transactions_summary AS (
    SELECT
        user_id,
        asset,
        SUM(CASE WHEN type = 'buy' OR type = 'in' THEN amount ELSE 0 END) AS total_inflow,
        SUM(CASE WHEN type = 'sell' OR type = 'out' THEN amount ELSE 0 END) AS total_outflow,
        SUM(CASE WHEN type = 'buy' THEN acquisition_price_total ELSE 0 END) AS total_buy_cost_ever,
        SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) AS total_buy_amount_ever
    FROM
        public.v_all_transactions
    WHERE type != 'internal_transfer'
    GROUP BY
        user_id, asset
)
-- Step 3: 譛邨ら噪縺ｪ謖・ｨ吶ｒ邂怜・
SELECT
    t.user_id,
    t.asset,
    (t.total_inflow - t.total_outflow) AS current_amount,
    t.total_buy_cost_ever AS total_investment,
    CASE WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever) ELSE 0 END AS average_buy_price,
    (t.total_inflow - t.total_outflow) * (CASE WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever) ELSE 0 END) AS cost_of_current_holdings,
    p.price_jpy AS current_price,
    ( (t.total_inflow - t.total_outflow) * p.price_jpy ) -
    ( (t.total_inflow - t.total_outflow) * (CASE WHEN t.total_buy_amount_ever > 0 THEN (t.total_buy_cost_ever / t.total_buy_amount_ever) ELSE 0 END) ) AS unrealized_pnl
FROM
    transactions_summary t
LEFT JOIN current_prices p ON t.asset = p.asset
WHERE
    (t.total_inflow - t.total_outflow) > 1e-9;


-- File: 20251210_update_all_transactions_view.sql
-- supabase/migrations/20251210_update_all_transactions_view.sql
-- PURPOSE: Updates the all_transactions view to include quote_asset and derive price from fee_currency.

-- Drop the existing view to recreate it with the new structure
DROP VIEW IF EXISTS public.all_transactions;

-- Create the updated view
CREATE OR REPLACE VIEW public.all_transactions AS

-- =================================================================
-- On-chain Transactions (FROM: public.wallet_transactions)
-- =================================================================
SELECT
    t.id::text, -- Cast UUID to TEXT
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset, -- Base asset
    NULL AS quote_asset, -- No quote asset for on-chain tx
    NULL AS price,       -- No price for on-chain tx
    t.direction AS type, -- 'IN' or 'OUT'
    'on-chain' as source,
    t.chain_id::text AS chain
FROM
    public.wallet_transactions t

UNION ALL

-- =================================================================
-- Exchange Trades (FROM: public.exchange_trades)
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    -- Description now uses the calculated per-unit price for consistency
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' ||
      (CASE
          WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
          ELSE 0
      END)::text AS description,
    et.amount,
    split_part(et.symbol, '/', 1) AS asset,      -- Base asset (e.g., BTC)
    split_part(et.symbol, '/', 2) AS quote_asset, -- Quote asset (e.g., USD)
    -- Per-unit price is calculated from fee_currency (total cost) / amount
    CASE
      WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
      ELSE 0
    END AS price,
    et.side AS type, -- 'buy' or 'sell'
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et;


-- File: 20251211_force_update_all_transactions_view.sql
-- supabase/migrations/20251211_force_update_all_transactions_view.sql
-- PURPOSE: Force update the all_transactions view to ensure schema changes are applied.

-- Drop the existing view to recreate it with the new structure
DROP VIEW IF EXISTS public.all_transactions;

-- Create the updated view
CREATE OR REPLACE VIEW public.all_transactions AS

-- =================================================================
-- On-chain Transactions (FROM: public.wallet_transactions)
-- =================================================================
SELECT
    t.id::text, -- Cast UUID to TEXT
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset, -- Base asset
    NULL AS quote_asset, -- No quote asset for on-chain tx
    NULL AS price,       -- No price for on-chain tx
    t.direction AS type, -- 'IN' or 'OUT'
    'on-chain' as source,
    t.chain_id::text AS chain
FROM
    public.wallet_transactions t

UNION ALL

-- =================================================================
-- Exchange Trades (FROM: public.exchange_trades)
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    -- Description now uses the calculated per-unit price for consistency
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' ||
      (CASE
          WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
          ELSE 0
      END)::text AS description,
    et.amount,
    split_part(et.symbol, '/', 1) AS asset,      -- Base asset (e.g., BTC)
    split_part(et.symbol, '/', 2) AS quote_asset, -- Quote asset (e.g., USD)
    -- Per-unit price is calculated from fee_currency (total cost) / amount
    CASE
      WHEN et.amount IS NOT NULL AND et.amount <> 0 THEN et.fee_currency::numeric / et.amount
      ELSE 0
    END AS price,
    et.side AS type, -- 'buy' or 'sell'
    'exchange' as source,
    et.exchange AS chain
FROM
    public.exchange_trades et;


-- File: 20251213_add_connection_id_to_trades_fix.sql
-- Step 1 (fixed): Add exchange_connection_id to exchange_trades with the correct BIGINT type.

ALTER TABLE public.exchange_trades
ADD COLUMN IF NOT EXISTS exchange_connection_id BIGINT;

-- Add a foreign key constraint to link to the 'id' in the 'exchange_connections' table.
ALTER TABLE public.exchange_trades
ADD CONSTRAINT fk_exchange_connections
FOREIGN KEY (exchange_connection_id)
REFERENCES public.exchange_connections(id)
ON DELETE SET NULL;

-- Add an index for performance.
CREATE INDEX IF NOT EXISTS idx_exchange_trades_connection_id
ON public.exchange_trades(exchange_connection_id);


-- File: 20251214_add_identifiers_to_view.sql
-- supabase/migrations/20251214_add_identifiers_to_view.sql
-- PURPOSE: Add wallet_address and connection_name, AND critically, fix the amount calculation for SELL trades.

-- Drop the view and dependent views to redefine the base structure.
DROP VIEW IF EXISTS public.all_transactions CASCADE;

CREATE OR REPLACE VIEW public.all_transactions AS

-- =================================================================
-- On-chain Transactions (FROM: public.wallet_transactions)
-- This part remains unchanged.
-- =================================================================
SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'ETH') AS asset,
    NULL AS quote_asset,
    NULL AS price, -- On-chain transactions don't have a direct price.
    t.direction AS type,
    'on-chain' as source,
    t.chain_id::text AS chain,
    t.wallet_address,
    NULL::text AS connection_name
FROM
    public.wallet_transactions t

UNION ALL

-- =================================================================
-- Exchange Trades (FROM: public.exchange_trades)
-- 笘・・笘・THIS SECTION IS NOW CORRECTED 笘・・笘・
-- =================================================================
SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    -- Description remains as is, for human readability.
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text AS description,

    -- 笘・CRUCIAL FIX: Calculate the amount of the BASE asset correctly.
    CASE
        WHEN et.side = 'buy' THEN et.amount -- For buys, amount is already the base asset quantity.
        WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price -- For sells, calculate base asset quantity from quote amount and price.
        ELSE 0 -- If price is zero for a sell, we cannot know the amount, so default to 0.
    END AS amount,

    split_part(et.symbol, '/', 1) AS asset, -- e.g., 'BTC' from 'BTC/JPY'
    split_part(et.symbol, '/', 2) AS quote_asset, -- e.g., 'JPY' from 'BTC/JPY'

    -- 笘・FIX: Use the actual price from the exchange_trades table.
    et.price,

    et.side AS type, -- 'buy' or 'sell'
    'exchange' as source,
    et.exchange AS chain,
    NULL::text AS wallet_address,
    ec.connection_name
FROM
    public.exchange_trades et
LEFT JOIN
    public.exchange_connections ec ON et.exchange_connection_id = ec.id;


-- File: 20251215_implement_internal_transfers.sql
-- supabase/migrations/20251215_implement_internal_transfers.sql
-- PURPOSE: Redefine views to accurately identify and classify internal transfers.

-- First, drop the dependent views. They will be recreated below.
-- This ensures that changes in the underlying all_transactions view are correctly propagated.
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;

-- =================================================================
-- VIEW 1: internal_transfer_pairs
-- PURPOSE: Identifies pairs of transactions that represent an internal transfer
-- between a user's own accounts (e.g., exchange-to-wallet).
-- =================================================================
CREATE OR REPLACE VIEW public.internal_transfer_pairs AS
SELECT
    tx_out.user_id,
    tx_out.id AS withdrawal_id, -- The ID of the outgoing transaction
    tx_in.id AS deposit_id     -- The ID of the incoming transaction
FROM
    public.all_transactions tx_out
JOIN
    public.all_transactions tx_in
    ON tx_out.user_id = tx_in.user_id                                     -- Must be the same user
    AND tx_out.asset = tx_in.asset                                         -- Must be the same crypto asset
    -- 笘・FIXED: Match keywords using the unified 'type' column, removing reference to non-existent 'side' column.
    AND (tx_out.type ILIKE 'withdraw%' OR tx_out.type = 'send')
    AND (tx_in.type ILIKE 'deposit%' OR tx_in.type = 'receive')
    -- Amount must be very close (e.g., between 99.9% and 100% of sent amount to allow for fees)
    AND tx_in.amount BETWEEN (tx_out.amount * 0.999) AND tx_out.amount
    -- Deposit must happen *after* withdrawal, but within a 12-hour window
    AND tx_in.date > tx_out.date
    AND tx_in.date <= (tx_out.date + INTERVAL '12 hours')
    -- 笘・CRUCIAL: The source and destination must be different accounts.
    -- This relies on the connection_name and wallet_address columns from our previous step.
    AND COALESCE(tx_out.connection_name, tx_out.wallet_address) <> COALESCE(tx_in.connection_name, tx_in.wallet_address);


-- =================================================================
-- VIEW 2: v_all_transactions_classified
-- PURPOSE: Classifies all transactions, giving priority to internal transfers.
-- This view will be used by v_holdings for final calculations.
-- =================================================================
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
WITH all_internal_ids AS (
    -- Create a single, distinct list of all transaction IDs that are part of an internal transfer
    SELECT withdrawal_id AS id FROM public.internal_transfer_pairs
    UNION
    SELECT deposit_id AS id FROM public.internal_transfer_pairs
)
SELECT
    t.*, -- Select all columns from the base view 'all_transactions'
    -- Classify the transaction type, prioritizing internal transfers
    CASE
        WHEN ai.id IS NOT NULL THEN 'INTERNAL_TRANSFER'
        WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
        -- 笘・FIXED: Simplified the classification to match the corrected logic above.
        WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' THEN 'DEPOSIT'
        WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' THEN 'WITHDRAWAL'
        ELSE 'OTHER'
    END as transaction_type
FROM
    public.all_transactions t
LEFT JOIN
    all_internal_ids ai ON t.id = ai.id;


-- File: 20251216_fix_holdings_calculation.sql
-- supabase/migrations/20251216_fix_holdings_calculation.sql
-- PURPOSE: Final consolidated fix. This single file rebuilds the entire view chain correctly.
-- It re-creates all_transactions with the correct SELL logic, restores dependent views,
-- and creates the final, correct version of v_holdings.

-- Step 1: Drop potentially outdated views in reverse order of dependency.
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions_classified CASCADE;
DROP VIEW IF EXISTS public.internal_transfer_pairs CASCADE;
DROP VIEW IF EXISTS public.all_transactions CASCADE;

-- =================================================================
-- VIEW: all_transactions (Corrected version)
-- Re-created with the crucial fix for SELL trade amount calculation.
-- =================================================================
CREATE OR REPLACE VIEW public.all_transactions AS
-- On-chain Transactions
SELECT
    t.id::text, t.user_id, t.tx_hash AS reference_id, t.timestamp AS date,
    'On-chain: ' || t.direction || ' ' || COALESCE(t.asset_symbol, 'ETH') AS description,
    (t.value_wei / 1e18) AS amount, COALESCE(t.asset_symbol, 'ETH') AS asset, NULL AS quote_asset, NULL AS price,
    t.direction AS type, 'on-chain' as source, t.chain_id::text AS chain, t.wallet_address, NULL::text AS connection_name
FROM public.wallet_transactions t
UNION ALL
-- Exchange Trades (with corrected amount logic)
SELECT
    et.trade_id::text, et.user_id, et.trade_id::text, et.ts,
    'Exchange: ' || et.side || ' ' || et.amount::text || ' ' || et.symbol || ' @ ' || et.price::text,
    CASE
        WHEN et.side = 'buy' THEN et.amount
        WHEN et.side = 'sell' AND et.price IS NOT NULL AND et.price > 0 THEN et.amount / et.price
        ELSE 0
    END AS amount,
    split_part(et.symbol, '/', 1), split_part(et.symbol, '/', 2), et.price, et.side, 'exchange', et.exchange,
    NULL::text, ec.connection_name
FROM public.exchange_trades et
LEFT JOIN public.exchange_connections ec ON et.exchange_connection_id = ec.id;

-- =================================================================
-- VIEW: internal_transfer_pairs (Restored)
-- This view is restored to ensure no other part of the system breaks.
-- =================================================================
CREATE OR REPLACE VIEW public.internal_transfer_pairs AS
SELECT
    tx_out.user_id, tx_out.id AS withdrawal_id, tx_in.id AS deposit_id
FROM public.all_transactions tx_out
JOIN public.all_transactions tx_in ON tx_out.user_id = tx_in.user_id
    AND tx_out.asset = tx_in.asset
    AND (tx_out.type ILIKE 'withdraw%' OR tx_out.type = 'send')
    AND (tx_in.type ILIKE 'deposit%' OR tx_in.type = 'receive')
    AND tx_in.amount BETWEEN (tx_out.amount * 0.999) AND tx_out.amount
    AND tx_in.date > tx_out.date AND tx_in.date <= (tx_out.date + INTERVAL '12 hours')
    AND COALESCE(tx_out.connection_name, tx_out.wallet_address) <> COALESCE(tx_in.connection_name, tx_in.wallet_address);

-- =================================================================
-- VIEW: v_all_transactions_classified (Restored)
-- This view is also restored for system integrity.
-- =================================================================
CREATE OR REPLACE VIEW public.v_all_transactions_classified AS
WITH all_internal_ids AS (
    SELECT withdrawal_id AS id FROM public.internal_transfer_pairs
    UNION SELECT deposit_id AS id FROM public.internal_transfer_pairs
)
SELECT
    t.*,
    CASE
        WHEN ai.id IS NOT NULL THEN 'INTERNAL_TRANSFER'
        WHEN t.type IN ('buy', 'sell') THEN UPPER(t.type)
        WHEN t.type ILIKE 'deposit%' OR t.type ILIKE 'receive%' THEN 'DEPOSIT'
        WHEN t.type ILIKE 'withdraw%' OR t.type ILIKE 'send%' THEN 'WITHDRAWAL'
        ELSE 'OTHER'
    END as transaction_type
FROM public.all_transactions t
LEFT JOIN all_internal_ids ai ON t.id = ai.id;

-- =================================================================
-- TABLE: asset_prices (Ensures it exists)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.asset_prices (asset TEXT PRIMARY KEY, current_price NUMERIC NOT NULL, last_updated TIMESTAMPTZ DEFAULT now());
INSERT INTO public.asset_prices (asset, current_price) VALUES ('ETH', 3500.00), ('BTC', 68000.00) ON CONFLICT (asset) DO UPDATE SET current_price = EXCLUDED.current_price, last_updated = now();

-- =================================================================
-- VIEW: v_holdings (Final and Correct Version)
-- The definitive view with all fixes and enhancements applied.
-- =================================================================
CREATE OR REPLACE VIEW public.v_holdings AS
WITH base_calcs AS (
    SELECT
        user_id, asset,
        SUM(CASE WHEN type ILIKE 'buy' OR type ILIKE 'receive' OR type ILIKE 'deposit%' OR type ILIKE 'in' THEN amount ELSE 0 END) as total_inflow_amount,
        SUM(CASE WHEN type ILIKE 'sell' OR type ILIKE 'send' OR type ILIKE 'withdraw%' OR type ILIKE 'out' THEN amount ELSE 0 END) as total_outflow_amount,
        SUM(CASE WHEN type ILIKE 'buy' THEN amount * price ELSE 0 END) as total_buy_cost,
        SUM(CASE WHEN type ILIKE 'buy' THEN amount ELSE 0 END) as total_buy_quantity,
        SUM(CASE WHEN type ILIKE 'sell' THEN amount * price ELSE 0 END) as total_sell_proceeds,
        SUM(CASE WHEN type ILIKE 'sell' THEN amount ELSE 0 END) as total_sell_quantity
    FROM public.all_transactions GROUP BY user_id, asset
)
SELECT
    b.user_id, b.asset,
    (b.total_inflow_amount - b.total_outflow_amount) as current_amount,
    COALESCE(ap.current_price, 0) as current_price,
    ROUND((b.total_inflow_amount - b.total_outflow_amount) * COALESCE(ap.current_price, 0), 2) AS current_value,
    ROUND((CASE WHEN b.total_buy_quantity > 0 THEN b.total_buy_cost / b.total_buy_quantity ELSE 0 END), 2) as average_buy_price,
    ROUND(b.total_buy_cost, 2) as total_cost,
    ROUND(b.total_sell_proceeds - (b.total_sell_quantity * (CASE WHEN b.total_buy_quantity > 0 THEN b.total_buy_cost / b.total_buy_quantity ELSE 0 END)), 2) as realized_capital_gain_loss
FROM base_calcs b
LEFT JOIN public.asset_prices ap ON b.asset = ap.asset;


-- File: 20251217_update_withdrawal_logic.sql
-- supabase/migrations/20251217_update_withdrawal_logic.sql

-- 譌｢蟄倥・繝薙Η繝ｼ繧貞炎髯､縺励∽ｾ晏ｭ倬未菫ゅｒ蜀肴ｧ狗ｯ峨＠縺ｾ縺吶・
DROP VIEW IF EXISTS public.v_holdings CASCADE;
DROP VIEW IF EXISTS public.v_all_transactions CASCADE;

CREATE OR REPLACE VIEW public.v_all_transactions AS
WITH
-- Step 1: 繝ｦ繝ｼ繧ｶ繝ｼ縺碁｣謳ｺ縺励※縺・ｋ蜈ｨ縺ｦ縺ｮ繧ｦ繧ｩ繝ｬ繝・ヨ繧｢繝峨Ξ繧ｹ縺ｨ蜿門ｼ墓園縺ｮ謗･邯壽ュ蝣ｱ繧堤ｵｱ蜷・
-- connection_identifier 繧・TEXT 蝙九↓邨ｱ荳
user_connections AS (
  SELECT
    user_id,
    wallet_address AS connection_identifier,
    'wallet' AS connection_type
  FROM public.wallet_connections
  UNION ALL
  SELECT
    user_id,
    id::text AS connection_identifier, -- BIGINT繧探EXT縺ｫ繧ｭ繝｣繧ｹ繝・
    'exchange' AS connection_type
  FROM public.exchange_connections
),

-- Step 2: 繧ｪ繝ｳ繝√ぉ繝ｼ繝ｳ繝医Λ繝ｳ繧ｶ繧ｯ繧ｷ繝ｧ繝ｳ繧貞・鬘槭＠縲ゞSD謠帷ｮ怜､縺ｨ萓｡譬ｼ繧定ｿｽ蜉
onchain_txs AS (
  SELECT
    t.id::text,
    t.user_id,
    t.tx_hash AS reference_id,
    t.timestamp AS date,
    (t.value_wei / 1e18) AS amount,
    COALESCE(t.asset_symbol, 'UNKNOWN_ASSET') AS asset,
    t.chain_id::text AS chain,
    -- 騾・≡蜈・騾・≡蜈医′繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ騾｣謳ｺ貂医∩繧ｦ繧ｩ繝ｬ繝・ヨ縺ｮ蝣ｴ蜷・'internal_transfer' 縺ｫ蛻・｡・
    CASE
      WHEN t.direction = 'in' AND t.from_address IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = t.user_id AND uc.connection_type = 'wallet') THEN 'internal_transfer'
      WHEN t.direction = 'out' AND t.to_address IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = t.user_id AND uc.connection_type = 'wallet') THEN 'internal_transfer'
      ELSE t.direction -- 縺昴ｌ莉･螟悶・逵溘・縲悟・驥・in)縲阪∪縺溘・縲碁・≡(out)縲・
    END AS type,
    NULL::numeric AS acquisition_price_total, -- exchange_txs 縺ｨ謨ｴ蜷域ｧ繧偵→繧九◆繧√↓霑ｽ蜉
    NULL::text AS quote_asset,               -- exchange_txs 縺ｨ謨ｴ蜷域ｧ繧偵→繧九◆繧√↓霑ｽ蜉
    t.value_usd AS value_in_usd, -- USD謠帷ｮ怜､繧定ｿｽ蜉
    CASE
      WHEN (t.value_wei / 1e18) > 0 AND t.value_usd IS NOT NULL THEN (t.value_usd / (t.value_wei / 1e18))
      ELSE NULL
    END AS price -- 萓｡譬ｼ繧定ｿｽ蜉 (USD謠帷ｮ怜､ / 謨ｰ驥・
  FROM
    public.wallet_transactions t
),

-- Step 3: 蜿門ｼ墓園縺ｮ蜿門ｼ輔ｒ蛻・｡槭＠縲ゞSD謠帷ｮ怜､縺ｨ萓｡譬ｼ繧定ｿｽ蜉
exchange_txs AS (
  -- Section A: 豕募ｮ夐夊ｲｨ縺ｨ縺ｮ螢ｲ雋ｷ (buy/sell)
  SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    (et.raw_data->>'obtainAmount')::numeric AS amount,
    (et.raw_data->>'cryptoCurrency') AS asset,
    et.exchange AS chain,
    CASE
      WHEN et.raw_data->>'transactionType' = '0' THEN 'buy'
      WHEN et.raw_data->>'transactionType' = '1' THEN 'sell'
      ELSE 'unknown'
    END AS type,
    (et.raw_data->>'sourceAmount')::numeric AS acquisition_price_total,
    (et.raw_data->>'fiatCurrency') AS quote_asset,
    et.value_usd AS value_in_usd, -- USD謠帷ｮ怜､繧定ｿｽ蜉
    CASE
      WHEN (et.raw_data->>'obtainAmount')::numeric > 0 AND et.value_usd IS NOT NULL THEN et.value_usd / (et.raw_data->>'obtainAmount')::numeric
      ELSE NULL
    END AS price -- 萓｡譬ｼ繧定ｿｽ蜉
  FROM public.exchange_trades et
  WHERE et.symbol LIKE '%/%'

  UNION ALL

  -- Section B: 證怜捷雉・肇縺ｮ蜃ｺ驥・(withdrawal)
  SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    et.amount,
    et.symbol AS asset,
    et.exchange AS chain,
    -- 蜃ｺ驥大・縺後Θ繝ｼ繧ｶ繝ｼ縺ｮ騾｣謳ｺ貂医∩繧ｦ繧ｩ繝ｬ繝・ヨ/蜿門ｼ墓園縺ｮ蝣ｴ蜷・'internal_transfer' 縺ｫ蛻・｡・
    CASE
      WHEN (et.raw_data->>'address') IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = et.user_id AND uc.connection_type = 'wallet') THEN 'internal_transfer'
      -- et.exchange_connection_id 繧・TEXT 縺ｫ繧ｭ繝｣繧ｹ繝医＠縺ｦ豈碑ｼ・
      WHEN et.exchange_connection_id::text IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = et.user_id AND uc.connection_type = 'exchange') THEN 'internal_transfer'
      ELSE 'withdrawal' -- 縺昴ｌ莉･螟悶・逵溘・縲悟､夜Κ蜃ｺ驥・withdrawal)縲・
    END AS type,
    NULL::numeric AS acquisition_price_total, -- withdrawal縺ｧ縺ｯ荳崎ｦ√¨ULL繧呈・遉ｺ
    NULL::text AS quote_asset,               -- withdrawal縺ｧ縺ｯ荳崎ｦ√¨ULL繧呈・遉ｺ
    et.value_usd AS value_in_usd, -- USD謠帷ｮ怜､繧定ｿｽ蜉
    CASE
      WHEN et.amount > 0 AND et.value_usd IS NOT NULL THEN et.value_usd / et.amount
      ELSE NULL
    END AS price -- 萓｡譬ｼ繧定ｿｽ蜉
  FROM public.exchange_trades et
  WHERE et.side = 'withdrawal'

  UNION ALL

  -- Section C: 證怜捷雉・肇縺ｮ蜈･驥・(deposit)
  SELECT
    et.trade_id::text AS id,
    et.user_id,
    et.trade_id::text AS reference_id,
    et.ts AS date,
    et.amount,
    et.symbol AS asset,
    et.exchange AS chain,
    -- 蜈･驥大・縺後Θ繝ｼ繧ｶ繝ｼ縺ｮ騾｣謳ｺ貂医∩繧ｦ繧ｩ繝ｬ繝・ヨ/蜿門ｼ墓園縺ｮ蝣ｴ蜷・'internal_transfer' 縺ｫ蛻・｡・
    CASE
      WHEN (et.raw_data->>'address') IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = et.user_id AND uc.connection_type = 'wallet') THEN 'internal_transfer'
      -- et.exchange_connection_id 繧・TEXT 縺ｫ繧ｭ繝｣繧ｹ繝医＠縺ｦ豈碑ｼ・
      WHEN et.exchange_connection_id::text IN (SELECT connection_identifier FROM user_connections uc WHERE uc.user_id = et.user_id AND uc.connection_type = 'exchange') THEN 'internal_transfer'
      ELSE 'deposit' -- 縺昴ｌ莉･螟悶・逵溘・縲悟､夜Κ蜈･驥・deposit)縲・
    END AS type,
    NULL::numeric AS acquisition_price_total, -- deposit縺ｧ縺ｯ荳崎ｦ√¨ULL繧呈・遉ｺ
    NULL::text AS quote_asset,               -- deposit縺ｧ縺ｯ荳崎ｦ√¨ULL繧呈・遉ｺ
    et.value_usd AS value_in_usd, -- USD謠帷ｮ怜､繧定ｿｽ蜉
    CASE
      WHEN et.amount > 0 AND et.value_usd IS NOT NULL THEN et.value_usd / et.amount
      ELSE NULL
    END AS price
  FROM public.exchange_trades et
  WHERE et.side = 'deposit'
),

-- Step 4: 蜈ｨ縺ｦ縺ｮ蛻・｡樊ｸ医∩蜿門ｼ輔ｒ邨仙粋
all_combined_txs AS (
    SELECT
        id, user_id, reference_id, date, amount, asset, chain, type, acquisition_price_total, quote_asset, value_in_usd, price
    FROM onchain_txs
    UNION ALL
    SELECT
        id, user_id, reference_id, date, amount, asset, chain, type, acquisition_price_total, quote_asset, value_in_usd, price
    FROM exchange_txs
)

-- Final Step: 譛邨ゅン繝･繝ｼ繧剃ｽ懈・
SELECT
    id,
    user_id,
    reference_id,
    date,
    type || ' ' || amount::text || ' ' || asset AS description,
    amount,
    asset,
    quote_asset,
    price,
    acquisition_price_total,
    value_in_usd,
    type,
    CASE WHEN chain ~ '^[0-9\.]+$' THEN 'on-chain' ELSE 'exchange' END AS source,
    chain,
    -- 蜀・Κ騾・≡縺ｮ蝣ｴ蜷医「sage繧・internal_transfer'縺ｫ險ｭ螳壹ゅ◎繧御ｻ･螟悶・譌｢蟄倥・繝ｭ繧ｸ繝・け・医∪縺溘・NULL・・
    CASE
      WHEN type = 'internal_transfer' THEN 'internal_transfer'
      ELSE NULL -- 蠢・ｦ√↓蠢懊§縺ｦexchange_trades繧жallet_transactions縺九ｉusage繧偵・繝・ヴ繝ｳ繧ｰ
    END AS usage,
    NULL::text AS note -- 蠢・ｦ√↓蠢懊§縺ｦnote繧定ｿｽ蜉
FROM all_combined_txs;


-- v_holdings縺ｮ蜀肴ｧ狗ｯ・
-- v_all_transactions縺ｫ萓晏ｭ倥☆繧九◆繧√」_all_transactions縺ｮ螳夂ｾｩ蠕後↓螳溯｡・

CREATE OR REPLACE VIEW public.v_holdings AS
WITH latest_prices AS (
    -- 蜷・ｳ・肇縺ｮ譛譁ｰ縺ｮ萓｡譬ｼ繧貞叙蠕・
    SELECT DISTINCT ON (asset)
        asset,
        price AS latest_usd_price
    FROM public.v_all_transactions
    WHERE value_in_usd IS NOT NULL AND amount > 0 AND price IS NOT NULL
    ORDER BY asset, date DESC
),
transaction_summary AS (
    SELECT
        user_id,
        asset,
        SUM(
            CASE
                WHEN type IN ('deposit', 'buy') THEN amount
                WHEN type IN ('withdrawal', 'sell') THEN -amount
                ELSE 0
            END
        ) AS total_amount,
        SUM(
            CASE
                WHEN type IN ('deposit', 'buy') THEN value_in_usd
                WHEN type IN ('withdrawal', 'sell') THEN -value_in_usd
                ELSE 0
            END
        ) AS total_value_usd
    FROM
        public.v_all_transactions
    WHERE
        type NOT IN ('internal_transfer') -- 蜀・Κ騾・≡縺ｯ菫晄怏谿矩ｫ倥↓蠖ｱ髻ｿ縺励↑縺・◆繧・勁螟・
    GROUP BY
        user_id,
        asset
)
SELECT
    ts.user_id,
    ts.asset,
    ts.total_amount AS quantity,
    COALESCE(ts.total_value_usd, ts.total_amount * lp.latest_usd_price) AS current_value_usd,
    lp.latest_usd_price AS price_per_unit_usd,
    CURRENT_TIMESTAMP AS last_updated
FROM
    transaction_summary ts
LEFT JOIN
    latest_prices lp ON ts.asset = lp.asset
WHERE
    ts.total_amount <> 0; -- 谿矩ｫ倥′0縺ｧ縺ｯ縺ｪ縺・ｂ縺ｮ縺ｮ縺ｿ陦ｨ遉ｺ


-- File: 20251218_update_exchange_trades_usd_values.sql
-- supabase/migrations/20251218_update_exchange_trades_usd_values.sql

-- public.exchange_trades 繝・・繝悶Ν縺ｮ value_usd 縺ｨ price 繧呈峩譁ｰ縺吶ｋ
WITH trades_with_rates AS (
    SELECT
        et.id AS trade_id,
        (
            SELECT er.rate
            FROM public.daily_exchange_rates er
            WHERE er.source_currency = et.symbol
              AND er.target_currency = 'USD'
              AND er.date <= DATE(et.ts) -- 蜿門ｼ墓律莉･蜑阪・譛譁ｰ繝ｬ繝ｼ繝医ｒ蜿門ｾ・
            ORDER BY er.date DESC
            LIMIT 1
        ) AS retrieved_rate,
        et.amount
    FROM
        public.exchange_trades et
    WHERE
        et.value_usd IS NULL -- value_usd 縺・NULL 縺ｮ陦後・縺ｿ繧貞ｯｾ雎｡
        AND (et.side = 'withdrawal' OR et.side = 'deposit') -- 蜃ｺ驥代→蜈･驥代↓髯仙ｮ・
)
UPDATE public.exchange_trades AS et
SET
    value_usd = twr.retrieved_rate * twr.amount,
    price = twr.retrieved_rate
FROM
    trades_with_rates twr
WHERE
    et.id = twr.trade_id
    AND twr.retrieved_rate IS NOT NULL; -- 繝ｬ繝ｼ繝医′蜿門ｾ励〒縺阪◆陦後・縺ｿ繧呈峩譁ｰ


-- File: 20251219000000_add_date_to_financial_statements.sql

-- PURPOSE: Adds the `date` column to financial statement views for daily reporting.
-- DEPENDS ON: `all_transactions.date` column.

-- Drop existing views to be safe with dependencies
DROP VIEW IF EXISTS public.v_balance_sheet CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS public.v_profit_loss_statement CASCADE;


-- =================================================================
-- VIEW 1: v_profit_loss_statement (with date)
-- =================================================================
CREATE OR REPLACE VIEW public.v_profit_loss_statement AS
WITH pnl_items AS (
    -- Revenue & Other Income
    SELECT user_id, date, 'Sales Revenue (IAS 2)'::text AS account, value_in_usd AS balance FROM public.all_transactions WHERE usage = 'sale_ias2' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, date, 'Consideration Revenue (IFRS 15)'::text, value_in_usd FROM public.all_transactions WHERE usage = 'revenue_ifrs15' AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, date, 'Staking & Mining Rewards'::text, value_in_usd FROM public.all_transactions WHERE usage = ANY (ARRAY['mining_rewards'::text, 'staking_rewards'::text]) AND value_in_usd IS NOT NULL
    UNION ALL
    -- Expenses & Losses
    SELECT user_id, date, 'Cost of Goods Sold (IAS 2)'::text, -value_in_usd FROM public.all_transactions WHERE usage = 'sale_ias2'
    UNION ALL
    SELECT user_id, date, 'Unrealized Gains on Intangibles (Revaluation)'::text, value_in_usd FROM public.all_transactions WHERE usage = 'revaluation_increase_ias38'::text
    UNION ALL
    SELECT user_id, date, 'Unrealized Losses on Intangibles (Impairment)'::text, -value_in_usd FROM public.all_transactions WHERE usage = ANY (ARRAY['impairment_ias38'::text, 'revaluation_decrease_ias38'::text])
    UNION ALL
    SELECT user_id, date, 'Realized Gains on Intangibles (Sale)'::text, 0 FROM public.all_transactions WHERE usage = 'sale_ias38'::text
    UNION ALL
    SELECT user_id, date, 'Gas & Network Fees'::text, -value_in_usd FROM public.all_transactions WHERE usage = 'gas_fees'::text AND value_in_usd IS NOT NULL
    UNION ALL
    SELECT user_id, date, 'Loss of Crypto (Unrecoverable)'::text, -value_in_usd FROM public.all_transactions WHERE usage = 'loss_unrecoverable'::text AND value_in_usd IS NOT NULL
)
SELECT
    user_id,
    date,
    account,
    SUM(balance) AS balance
FROM pnl_items
WHERE user_id IS NOT NULL AND balance IS NOT NULL
GROUP BY user_id, date, account
ORDER BY user_id, date, account;


-- =================================================================
-- VIEW 2: v_cash_flow_statement (with date)
-- =================================================================
CREATE OR REPLACE VIEW public.v_cash_flow_statement AS
WITH cash_flows AS (
    SELECT user_id, date, 'Inflow from Sales (IAS 2 & IFRS 15)'::text AS item, sum(value_in_usd) AS cash_flow FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'revenue_ifrs15'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Outflow for Inventory (IAS 2)'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2'::text GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Outflow for Gas Fees'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = 'gas_fees'::text GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Outflow for Intangible Assets'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = 'investment_acquisition_ias38'::text GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Inflow from Sale of Intangibles'::text, sum(value_in_usd) FROM public.all_transactions WHERE usage = 'sale_ias38'::text GROUP BY user_id, date
)
SELECT
    user_id,
    date,
    item,
    SUM(cash_flow) AS amount
FROM cash_flows
WHERE user_id IS NOT NULL AND cash_flow IS NOT NULL
GROUP BY user_id, date, item
ORDER BY user_id, date,
    CASE item
        WHEN 'Inflow from Sales (IAS 2 & IFRS 15)'::text THEN 1
        WHEN 'Outflow for Inventory (IAS 2)'::text THEN 2
        WHEN 'Outflow for Gas Fees'::text THEN 3
        WHEN 'Outflow for Intangible Assets'::text THEN 4
        WHEN 'Inflow from Sale of Intangibles'::text THEN 5
        ELSE 99
    END;

-- =================================================================
-- VIEW 3: v_balance_sheet (with date)
-- =================================================================
CREATE OR REPLACE VIEW public.v_balance_sheet AS
WITH account_movements AS (
    -- Asset Movements from all_transactions
    SELECT user_id, date, 'Intangible Assets (Investing Crypto)'::text AS account, sum(value_in_usd) AS balance_change FROM public.all_transactions WHERE usage = ANY (ARRAY['investment_acquisition_ias38'::text, 'mining_rewards'::text, 'staking_rewards'::text, 'revenue_ifrs15'::text, 'revaluation_increase_ias38'::text, 'crypto_to_crypto_exchange'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Inventory (Trading Crypto)'::text, sum(value_in_usd) FROM public.all_transactions WHERE usage = 'trading_acquisition_ias2'::text GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Intangible Assets (Investing Crypto)'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias38'::text, 'impairment_ias38'::text, 'loss_unrecoverable'::text, 'revaluation_decrease_ias38'::text, 'gas_fees'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Inventory (Trading Crypto)'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias2'::text, 'lcnrv_ias2'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Cash & Cash Equivalents'::text, sum(value_in_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['sale_ias38'::text, 'sale_ias2'::text]) GROUP BY user_id, date
    UNION ALL
    SELECT user_id, date, 'Cash & Cash Equivalents'::text, sum(-value_in_usd) FROM public.all_transactions WHERE usage = ANY (ARRAY['investment_acquisition_ias38'::text, 'trading_acquisition_ias2'::text, 'crypto_to_crypto_exchange'::text]) GROUP BY user_id, date
    
    -- Equity Movements from the now-daily v_profit_loss_statement
    UNION ALL
    SELECT p.user_id, p.date, 'Retained Earnings'::text, sum(p.balance) FROM public.v_profit_loss_statement p WHERE p.account <> 'Unrealized Gains on Intangibles (Revaluation)'::text GROUP BY p.user_id, p.date
    UNION ALL
    SELECT p.user_id, p.date, 'Revaluation Surplus'::text, sum(p.balance) FROM public.v_profit_loss_statement p WHERE p.account = 'Unrealized Gains on Intangibles (Revaluation)'::text GROUP BY p.user_id, p.date
)
SELECT
    user_id,
    date,
    account,
    SUM(balance_change) AS balance
FROM account_movements m
WHERE account IS NOT NULL AND balance_change IS NOT NULL
GROUP BY user_id, date, account
ORDER BY user_id, date, account;


-- File: 20251219120000_fix_holdings_view.sql

-- Recreate v_holdings with multi-currency support and correct column names.

-- Drop the existing view AND any dependent objects (like v_holdings_all_currencies).
DROP VIEW IF EXISTS public.v_holdings CASCADE;

-- Recreate the view
CREATE OR REPLACE VIEW public.v_holdings AS
WITH
-- CTE 1: Get the latest exchange rates for JPY, EUR, GBP from USD.
latest_rates AS (
    SELECT
        target_currency,
        rate
    FROM (
        SELECT
            target_currency,
            rate,
            -- Rank rates by date for each currency
            ROW_NUMBER() OVER(PARTITION BY target_currency ORDER BY date DESC) as rn
        FROM public.daily_exchange_rates
        WHERE source_currency = 'USD' AND target_currency IN ('JPY', 'EUR', 'GBP')
    ) AS ranked_rates
    WHERE rn = 1
),
-- CTE 2: Calculate cost basis from 'BUY' transactions.
acquisitions AS (
    SELECT
        user_id,
        asset,
        sum(value_in_usd) AS total_cost_basis,
        sum(amount) AS total_amount_acquired
    FROM
        public.v_all_transactions_classified
    WHERE
        transaction_type = 'BUY' AND (usage <> 'internal_transfer' OR usage IS NULL)
    GROUP BY
        user_id,
        asset
),
-- CTE 3: Calculate the current holding quantity of each asset.
current_quantities AS (
    SELECT
        user_id,
        asset,
        sum(
            CASE
                WHEN transaction_type IN ('BUY', 'DEPOSIT') THEN amount
                WHEN transaction_type IN ('SELL', 'WITHDRAWAL') THEN -amount
                ELSE 0
            END
        ) AS current_amount
    FROM
        public.v_all_transactions_classified
    WHERE
        (transaction_type <> 'INTERNAL_TRANSFER')
    GROUP BY
        user_id,
        asset
)
-- Final SELECT to build the view
SELECT
    cq.user_id,
    cq.asset,
    cq.current_amount,
    ap.current_price AS current_price_usd,
    (cq.current_amount * ap.current_price) AS current_value, -- The required "current_value" column
    (cq.current_amount * ap.current_price) AS current_value_usd, -- Explicit USD value
    -- Add values for other currencies
    (cq.current_amount * ap.current_price * (SELECT rate FROM latest_rates WHERE target_currency = 'JPY')) AS current_value_jpy,
    (cq.current_amount * ap.current_price * (SELECT rate FROM latest_rates WHERE target_currency = 'EUR')) AS current_value_eur,
    (cq.current_amount * ap.current_price * (SELECT rate FROM latest_rates WHERE target_currency = 'GBP')) AS current_value_gbp,
    -- P&L columns from the previous version
    COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0) AS "avg_buy_price",
    (cq.current_amount * ap.current_price) - (cq.current_amount * COALESCE(acq.total_cost_basis / NULLIF(acq.total_amount_acquired, 0), 0)) AS "unrealized_pnl",
    now() AS last_updated
FROM
    current_quantities cq
-- Join with asset prices (for USD price)
JOIN
    public.asset_prices ap ON cq.asset = ap.asset
-- Left Join for cost basis (some assets might not have a buy history)
LEFT JOIN
    acquisitions acq ON cq.user_id = acq.user_id AND cq.asset = acq.asset
WHERE
    cq.current_amount > 1e-9; -- Filter out dust balances


