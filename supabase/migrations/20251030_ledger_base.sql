-- 基本マスタ：用途カテゴリ（IFRS準拠の扱いメモ付き）
create table if not exists public.usage_categories (
  key text primary key,
  ifrs_standard text,
  description text
);

insert into public.usage_categories(key, ifrs_standard, description) values
('investment','IAS38','一般保有（無形資産、コストモデルのみ）'),
('impairment','IAS36','減損（IAS38コストモデル前提）'),
('inventory_trader','IAS2','通常の棚卸（LCNRV）'),
('inventory_broker','IAS2','ブローカー特例（FVLCS）'),
('ifrs15_non_cash','IFRS15','非現金対価（後日請求管理と連携）'),
('mining','Conceptual','マイニング報酬'),
('staking','Conceptual','ステーキング報酬'),
('disposal_sale','IAS38','売却/除却')
on conflict (key) do nothing;

-- TXへの用途ラベル（予測＆確定）
create table if not exists public.transaction_usage_labels (
  id uuid primary key default gen_random_uuid(),
  tx_id bigint not null references public.wallet_transactions(id) on delete cascade,
  user_id uuid not null,
  predicted_key text references public.usage_categories(key),
  confirmed_key text references public.usage_categories(key),
  confidence numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tx_usage_user_tx on public.transaction_usage_labels(user_id, tx_id);

-- 仕訳ヘッダ
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tx_id bigint,
  entry_date timestamptz not null,
  source text not null default 'auto', -- auto|manual
  usage_key text references public.usage_categories(key),
  memo text,
  created_at timestamptz default now()
);

-- 仕訳明細（二重仕訳）
create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_code text not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  meta jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_jlines_entry on public.journal_lines(entry_id);

-- RLS（profilesと同等の方針でユーザー縛り）
alter table public.transaction_usage_labels enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='tx_usage_select_owner') then
    create policy tx_usage_select_owner on public.transaction_usage_labels
    for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname='tx_usage_ins_owner') then
    create policy tx_usage_ins_owner on public.transaction_usage_labels
    for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname='tx_usage_upd_owner') then
    create policy tx_usage_upd_owner on public.transaction_usage_labels
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname='je_select_owner') then
    create policy je_select_owner on public.journal_entries
    for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname='je_ins_owner') then
    create policy je_ins_owner on public.journal_entries
    for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname='je_upd_owner') then
    create policy je_upd_owner on public.journal_entries
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname='jl_select_owner') then
    create policy jl_select_owner on public.journal_lines
    for select using (
      exists (select 1 from public.journal_entries je
              where je.id = entry_id and je.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='jl_ins_owner') then
    create policy jl_ins_owner on public.journal_lines
    for insert with check (
      exists (select 1 from public.journal_entries je
              where je.id = entry_id and je.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='jl_upd_owner') then
    create policy jl_upd_owner on public.journal_lines
    for update using (
      exists (select 1 from public.journal_entries je
              where je.id = entry_id and je.user_id = auth.uid())
    ) with check (
      exists (select 1 from public.journal_entries je
              where je.id = entry_id and je.user_id = auth.uid())
    );
  end if;
end $$;
