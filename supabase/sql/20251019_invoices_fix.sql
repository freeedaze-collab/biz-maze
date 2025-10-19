-- === Invoices table: create if missing ======================================
create table if not exists public.invoices (
  id                     bigserial primary key,
  user_id                uuid not null,
  company_id             uuid,
  client_id              uuid,
  company_wallet_address text,

  -- ← フロントが挿入する 'number' カラム（テキスト型）
  number                 text,

  currency               text default 'USD',
  issue_date             date,
  due_date               date,

  -- 明細は JSONB で保存（desc/qty/unit_price の配列）
  items                  jsonb,

  subtotal               numeric,
  tax                    numeric,
  total                  numeric,
  notes                  text,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- === Add missing columns safely =============================================
alter table public.invoices
  add column if not exists user_id                uuid not null;

alter table public.invoices
  add column if not exists company_id             uuid;

alter table public.invoices
  add column if not exists client_id              uuid;

alter table public.invoices
  add column if not exists company_wallet_address text;

alter table public.invoices
  add column if not exists number                 text;

alter table public.invoices
  add column if not exists currency               text default 'USD';

alter table public.invoices
  add column if not exists issue_date             date;

alter table public.invoices
  add column if not exists due_date               date;

alter table public.invoices
  add column if not exists items                  jsonb;

alter table public.invoices
  add column if not exists subtotal               numeric;

alter table public.invoices
  add column if not exists tax                    numeric;

alter table public.invoices
  add column if not exists total                  numeric;

alter table public.invoices
  add column if not exists notes                  text;

alter table public.invoices
  add column if not exists created_at             timestamptz not null default now();

alter table public.invoices
  add column if not exists updated_at             timestamptz not null default now();

-- === Helpful indexes =========================================================
create index if not exists invoices_user_id_idx    on public.invoices (user_id);
create index if not exists invoices_company_id_idx on public.invoices (company_id);
create index if not exists invoices_client_id_idx  on public.invoices (client_id);
create index if not exists invoices_issue_date_idx on public.invoices (issue_date);

-- === updated_at auto-touch trigger ==========================================
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'tg_invoices_set_updated_at'
  ) then
    create function public.tg_invoices_set_updated_at()
    returns trigger language plpgsql as $fn$
    begin
      new.updated_at := now();
      return new;
    end
    $fn$;
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'tr_invoices_set_updated_at'
  ) then
    create trigger tr_invoices_set_updated_at
      before update on public.invoices
      for each row execute function public.tg_invoices_set_updated_at();
  end if;
end
$$;

-- === RLS + minimal policies (own rows only) =================================
alter table public.invoices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_select_own'
  ) then
    create policy invoices_select_own on public.invoices
      for select using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_insert_own'
  ) then
    create policy invoices_insert_own on public.invoices
      for insert with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_update_own'
  ) then
    create policy invoices_update_own on public.invoices
      for update using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_delete_own'
  ) then
    create policy invoices_delete_own on public.invoices
      for delete using (user_id = auth.uid());
  end if;
end
$$;

-- === (Optional) soft FK (無効ならコメントアウトのままでOK) =================
-- alter table public.invoices
--   add constraint invoices_company_fk foreign key (company_id) references public.companies(id);
-- alter table public.invoices
--   add constraint invoices_client_fk  foreign key (client_id)  references public.clients(id);

-- === Done ===================================================================
