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
