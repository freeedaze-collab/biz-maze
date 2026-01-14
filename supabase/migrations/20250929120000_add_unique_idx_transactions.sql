-- profiles: 1 user = 1 profile
create unique index if not exists ux_profiles_user
  on public.profiles (user_id);

-- user_tax_settings: table does not exist in current schema, removing index creation.
