-- =========================================================
-- Companies / Clients (minimal) + invoices への列追加 + RLS
-- 対象: Supabase SQL Editor で実行
-- 既存のスキーマやポリシーを壊さないように作成順/存在チェックを配慮
-- =========================================================

-- 0) 依存拡張（Supabase では通常有効だが念のため）
create extension if not exists pgcrypto;

-- 1) テーブル作成 -----------------------------------------------------------
-- 会社（Your company）
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  address    text,
  country    text,
  tax_id     text,
  created_at timestamptz default now()
);

-- クライアント（Your client）
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  address    text,
  country    text,
  email      text,
  created_at timestamptz default now()
);

-- 2) invoices に不足カラムを追加（既存の列は維持） ---------------------------
-- 現在の Billing.tsx が customer_name を insert しているため追加して整合
alter table public.invoices
  add column if not exists customer_name text,
  add column if not exists company_id    uuid references public.companies(id) on delete set null,
  add column if not exists client_id     uuid references public.clients(id)    on delete set null;

-- 3) RLS 有効化 --------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.clients  enable row level security;

-- 4) RLS ポリシー（重複を避けるため DROP 後に CREATE） ----------------------
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

-- 5) パフォーマンス補助 ------------------------------------------------------
create index if not exists idx_companies_user_id on public.companies(user_id);
create index if not exists idx_clients_user_id   on public.clients(user_id);

-- =========================================================
-- 確認用（必要に応じて個別実行）
-- select tablename, rls_enabled
--   from pg_tables
--  where schemaname='public' and tablename in ('companies','clients');
--
-- select schemaname, tablename, policyname, cmd, roles
--   from pg_policies
--  where tablename in ('companies','clients')
--  order by tablename, policyname;
--
-- \d+ public.invoices   -- 追加列の確認（customer_name / company_id / client_id）
-- =========================================================
