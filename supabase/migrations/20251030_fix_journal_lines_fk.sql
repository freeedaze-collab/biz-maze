-- 1) 親テーブルの id 型を確認
do $$
declare
  parent_type text;
  jl_count bigint;
begin
  select data_type into parent_type
  from information_schema.columns
  where table_schema='public' and table_name='journal_entries' and column_name='id';

  if parent_type is null then
    -- まだ存在しない場合は、親を先に作る（bigint前提）※既存方針に合わせる
    execute $$
      create table if not exists public.journal_entries (
        id bigserial primary key,
        user_id uuid not null,
        tx_id bigint,
        entry_date timestamptz not null,
        source text not null default 'auto',
        usage_key text,
        memo text,
        created_at timestamptz default now()
      )
    $$;
    parent_type := 'bigint';
  end if;

  -- 2) 子テーブルの存在確認
  perform 1 from information_schema.tables
   where table_schema='public' and table_name='journal_lines';

  if found then
    -- 行数チェック
    execute 'select count(*) from public.journal_lines' into jl_count;

    if jl_count > 0 then
      raise notice 'journal_lines has % rows; please run a data-preserving migration instead of drop & recreate.', jl_count;
      raise exception 'Abort to avoid data loss.';
    end if;

    -- 既存が空なら安全に落とす
    execute 'drop table public.journal_lines';
  end if;

  -- 3) 親の型に合わせて子を作成
  if parent_type = 'uuid' then
    execute $$
      create table public.journal_lines (
        id uuid primary key default gen_random_uuid(),
        entry_id uuid not null references public.journal_entries(id) on delete cascade,
        account_code text not null,
        debit numeric not null default 0,
        credit numeric not null default 0,
        meta jsonb,
        created_at timestamptz default now()
      )
    $$;
  elsif parent_type = 'bigint' then
    execute $$
      create table public.journal_lines (
        id bigserial primary key,
        entry_id bigint not null references public.journal_entries(id) on delete cascade,
        account_code text not null,
        debit numeric not null default 0,
        credit numeric not null default 0,
        meta jsonb,
        created_at timestamptz default now()
      )
    $$;
  else
    raise exception 'Unsupported parent id type: %', parent_type;
  end if;

  -- 4) 必要なら RLS/Index を再付与
  -- RLSは親のuser制約に合わせて後段のポリシーを適用（重複作成防止）
  perform 1 from pg_policies where policyname='jl_select_owner';
  if not found then
    execute $$
      alter table public.journal_lines enable row level security;
      create policy jl_select_owner on public.journal_lines
      for select using (
        exists (select 1 from public.journal_entries je
                where je.id = entry_id and je.user_id = auth.uid())
      );
      create policy jl_ins_owner on public.journal_lines
      for insert with check (
        exists (select 1 from public.journal_entries je
                where je.id = entry_id and je.user_id = auth.uid())
      );
      create policy jl_upd_owner on public.journal_lines
      for update using (
        exists (select 1 from public.journal_entries je
                where je.id = entry_id and je.user_id = auth.uid())
      ) with check (
        exists (select 1 from public.journal_entries je
                where je.id = entry_id and je.user_id = auth.uid())
      );
    $$;
  end if;

  raise notice 'journal_lines recreated with entry_id type = %', parent_type;
end $$;
