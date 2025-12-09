-- 用途の機械推定（ヒントとして保持）。手動確定は transaction_usage_labels 側
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
