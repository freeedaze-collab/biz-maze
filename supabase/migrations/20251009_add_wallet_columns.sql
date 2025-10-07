-- profiles にウォレット紐付け用の列を追加（存在しなければ）
alter table public.profiles
  add column if not exists primary_wallet text,
  add column if not exists verify_nonce  text;

-- すでに RLS は user_id = auth.uid() で保護されている前提。
-- もし update ポリシーが無い場合のみ、以下を使ってください。
-- create policy if not exists allow_update_own_profile
--   on public.profiles
--   for update to authenticated
--   using (user_id = auth.uid())
--   with check (user_id = auth.uid());
