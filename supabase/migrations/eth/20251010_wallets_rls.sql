alter table if exists public.wallets enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wallets' and policyname='wallets_select_own') then
    create policy wallets_select_own on public.wallets for select to authenticated using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wallets' and policyname='wallets_insert_own') then
    create policy wallets_insert_own on public.wallets for insert to authenticated with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wallets' and policyname='wallets_update_own') then
    create policy wallets_update_own on public.wallets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wallets' and policyname='wallets_delete_own') then
    create policy wallets_delete_own on public.wallets for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;
