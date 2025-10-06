-- =========================================================
-- Companies / Clients (minimal fields) + RLS + FKs for invoices
-- 実行対象: Supabase SQL Editor
-- =========================================================

-- 1) テーブル作成 -----------------------------------------------------------

create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  address    text,
  country    text,
  tax_id     text,
  created_at timestamptz default now()
);

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  address    text,
  country    text,
  email      text,
  created_at timestamptz default now()
);

-- 2) 既存 invoices に外部キー列を追加（あればスキップ） -----------------------

alter table public.invoices
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists client_id  uuid references public.clients(id)   on delete set null;

-- 3) RLS 有効化 --------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.clients  enable row level security;

-- 4) RLS ポリシー（重複時は先に DROP → CREATE） -----------------------------

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

-- 5) 補助インデックス（ユーザー別一覧の体感を軽くする） -----------------------

create index if not exists idx_companies_user_id on public.companies(user_id);
create index if not exists idx_clients_user_id   on public.clients(user_id);

-- =========================================================
-- 動作確認用クエリ（必要に応じて個別実行してください）
-- =========================================================
-- \dt public.*
-- select tablename, rls_enabled from pg_tables where schemaname='public' and tablename in ('companies','clients');
-- select schemaname, tablename, policyname, cmd, roles from pg_policies where tablename in ('companies','clients') order by tablename, policyname;
