-- public.wallet_transactions: 連携ウォレットのチェーン履歴を保存
create table if not exists public.wallet_transactions (
  id            bigserial primary key,
  user_id       uuid not null,
  wallet_address text not null,
  chain_id      bigint not null default 1,           -- まずは ETH Mainnet を前提（必要なら拡張）
  direction     text not null,                       -- 'in' | 'out' | 'self'
  tx_hash       text not null unique,                -- 同一トランザクションは一意
  block_number  bigint,
  timestamp     timestamptz,
  from_address  text,
  to_address    text,
  value_wei     numeric,                             -- ネイティブ ETH の場合に格納（任意）
  asset_symbol  text,                                -- ERC20 などのシンボル（任意）
  raw           jsonb not null default '{}'::jsonb,  -- 取得した生データ一式
  created_at    timestamptz not null default now()
);

-- 最終同期ブロックを覚えるステート
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

-- パフォーマンス用
create index if not exists idx_wallet_tx_user_ts on public.wallet_transactions (user_id, timestamp desc);
