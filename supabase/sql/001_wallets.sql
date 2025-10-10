-- wallets テーブル（存在しなければ作成）
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  chain text not null default 'ethereum',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, address)
);

-- RLS 有効化
alter table public.wallets enable row level security;

-- IF NOT EXISTS を模倣して安全に作成
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'wallets'
      and policyname = 'wallets_select_self'
  ) then
    create policy wallets_select_self
      on public.wallets for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'wallets'
      and policyname = 'wallets_insert_self'
  ) then
    create policy wallets_insert_self
      on public.wallets for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'wallets'
      and policyname = 'wallets_update_self'
  ) then
    create policy wallets_update_self
      on public.wallets for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'wallets'
      and policyname = 'wallets_delete_self'
  ) then
    create policy wallets_delete_self
      on public.wallets for delete
      using (auth.uid() = user_id);
  end if;
end$$;
