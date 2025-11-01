-- 用途ラベル（ユーザーが手動で選ぶ最終確定ラベル）
create table if not exists public.transaction_usage_labels (
  -- アプリの認証ユーザー
  user_id uuid not null,
  -- どの取引に対するラベルか（あなたの実装では wallet_transactions.id を採用）
  tx_id   bigint not null references public.wallet_transactions(id) on delete cascade,

  -- ラベル値（必要に応じて追加OK）
  label text not null check (
    label in (
      'revenue','expense','transfer','investment','airdrop','payment','fee','internal','other'
    )
  ),

  -- 予備：旧実装で ctx_id を参照していた可能性に備える（NULL可）
  ctx_id bigint null,

  updated_at timestamptz not null default now(),

  -- ユニーク：同じユーザーが同じ取引に複数回付けられないように
  constraint transaction_usage_labels_unique_tx unique (user_id, tx_id),

  -- 旧UIが ctx_id で upsert していても一意になるように（ctx_id 利用時のみ有効）
  constraint transaction_usage_labels_unique_ctx unique (user_id, ctx_id)
);

-- RLS
alter table public.transaction_usage_labels enable row level security;

-- 自分の行だけ読める/書ける
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

-- パフォーマンス
create index if not exists idx_transaction_usage_labels_user_tx
  on public.transaction_usage_labels (user_id, tx_id);

create index if not exists idx_transaction_usage_labels_user_ctx
  on public.transaction_usage_labels (user_id, ctx_id);
