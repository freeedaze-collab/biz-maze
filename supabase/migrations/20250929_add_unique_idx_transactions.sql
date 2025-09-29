-- user_profiles: 1ユーザー=1プロフィール
create unique index if not exists ux_user_profiles_user
  on public.user_profiles (user_id);

-- user_tax_settings: 1ユーザー=1税務設定
create unique index if not exists ux_user_tax_settings_user
  on public.user_tax_settings (user_id);
