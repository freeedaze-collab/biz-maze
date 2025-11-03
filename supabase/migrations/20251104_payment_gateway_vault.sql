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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='payment_vault_addresses' and policyname='vault_select_own'
  ) then
    create policy vault_select_own
      on public.payment_vault_addresses
      for select
      using (user_id = auth.uid());

    create policy vault_ins_own
      on public.payment_vault_addresses
      for insert
      with check (user_id = auth.uid())
      to authenticated;

    create policy vault_upd_own
      on public.payment_vault_addresses
      for update
      using (user_id = auth.uid())
      to authenticated;
  end if;
end $$;
