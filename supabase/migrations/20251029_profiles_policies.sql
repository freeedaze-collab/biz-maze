-- Enable RLS if not enabled
alter table public.profiles enable row level security;

-- Safety: ensure user_id is unique (prevent duplicates)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'profiles_user_id_key'
  ) then
    alter table public.profiles add constraint profiles_user_id_key unique (user_id);
  end if;
end $$;

-- Optional: align id with user_id automatically on insert (keeps both equal)
-- If you already manage id=freshUser.id from app, you can skip this trigger.
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'profiles_align_ids'
  ) then
    create or replace function public.profiles_align_ids()
    returns trigger
    language plpgsql
    as $fn$
    begin
      if NEW.user_id is null then
        raise exception 'profiles.user_id must not be null';
      end if;
      -- if id is null or not equal, align id to user_id for consistency
      if NEW.id is null or NEW.id <> NEW.user_id then
        NEW.id := NEW.user_id;
      end if;
      return NEW;
    end;
    $fn$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_profiles_align_ids'
  ) then
    create trigger trg_profiles_align_ids
    before insert on public.profiles
    for each row execute procedure public.profiles_align_ids();
  end if;
end $$;

-- Clear existing policies (optional, only if you know existing ones are wrong)
-- drop policy if exists ...  -- (skip for safety in production)

-- SELECT policy: owner-only
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'profiles_select_owner_only'
  ) then
    create policy profiles_select_owner_only
    on public.profiles
    for select
    using (user_id = auth.uid());
  end if;
end $$;

-- INSERT policy: only self row, must satisfy WITH CHECK
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'profiles_insert_self_only'
  ) then
    create policy profiles_insert_self_only
    on public.profiles
    for insert
    with check (user_id = auth.uid());
  end if;
end $$;

-- UPDATE policy: only self row
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'profiles_update_owner_only'
  ) then
    create policy profiles_update_owner_only
    on public.profiles
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;
end $$;
