-- 取引原票
create table if not exists public.wallet_transactions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  chain text not null default 'ethereum',
  tx_hash text not null,
  log_index int not null default 0,
  block_number bigint not null,
  timestamp timestamptz not null,
  direction text not null,          -- 'in' | 'out'
  asset text not null,              -- 'ETH' など
  amount_numeric numeric(78,18) not null,
  from_addr text,
  to_addr text,
  fee_native numeric(78,18) default 0,
  raw jsonb,
  unique (user_id, tx_hash, log_index)
);

alter table public.wallet_transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wallet_transactions'
      and policyname='tx_select_self'
  ) then
    create policy tx_select_self
      on public.wallet_transactions for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wallet_transactions'
      and policyname='tx_insert_self'
  ) then
    create policy tx_insert_self
      on public.wallet_transactions for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wallet_transactions'
      and policyname='tx_update_self'
  ) then
    create policy tx_update_self
      on public.wallet_transactions for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wallet_transactions'
      and policyname='tx_delete_self'
  ) then
    create policy tx_delete_self
      on public.wallet_transactions for delete
      using (auth.uid() = user_id);
  end if;
end$$;

-- 仕訳（必要になったら）
create table if not exists public.journal_entries (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tx_id bigint references public.wallet_transactions(id) on delete cascade,
  entry_date date not null,
  account text not null,        -- 'Cash', 'Revenue', 'Gas Expense' など
  dc char(1) not null,          -- 'D' or 'C'
  amount numeric(78,18) not null,
  currency text not null default 'USD',
  memo text
);
alter table public.journal_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='journal_entries'
      and policyname='je_self_all'
  ) then
    create policy je_self_all
      on public.journal_entries for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;
