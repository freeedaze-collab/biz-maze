-- Ensure profiles table exists with id referencing auth.users and row-level security enabled:contentReference[oaicite:3]{index=3}
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  country varchar,
  category varchar,
  tax_info text,
  primary key (id)
);
alter table public.profiles enable row level security;

-- Add profile columns for country, category, and tax information if missing
alter table public.profiles
  add column if not exists country varchar,
  add column if not exists category varchar,
  add column if not exists tax_info text;

-- (Optional) Trigger to insert an empty profile when a new user signs up:contentReference[oaicite:4]{index=4}
create function if not exists public.handle_new_user()
  returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, country, category, tax_info)
  values (new.id, '', '', '');
  return new;
end;
$$;
create trigger if not exists on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
