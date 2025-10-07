-- =========================================================
-- transfers: 送金記録 + clients.wallet 追加（最小拡張）+ RLS
-- =========================================================

create extension if not exists pgcrypto;

-- 既存 clients に wallet カラム（無ければ）
alter table public.clients
  add column if not exists wallet text;

-- 送金記録テーブル
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  wallet_address text not null,
  amount numeric not null,
  currency text default 'ETH',
  tx_hash text,                  -- on-chain トランザクションハッシュ
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

-- 補助インデックス
create index if not exists idx_transfers_user_id on public.transfers(user_id);
create index if not exists idx_transfers_client_id on public.transfers(client_id);
