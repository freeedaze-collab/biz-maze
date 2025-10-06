-- Create reusable entities for invoices & extend profiles

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  wallet text,
  created_at timestamptz default now()
);

alter table public.invoices
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists item text;

alter table public.profiles
  add column if not exists country text,
  add column if not exists entity_type text check (entity_type in ('personal','corporate'));

-- RLS
create policy if not exists allow_user_manage_companies
  on public.companies for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists allow_user_manage_clients
  on public.clients for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
