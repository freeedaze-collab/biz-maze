-- プロファイルに primary_wallet と verify_nonce を追加（なければ）
alter table public.profiles
  add column if not exists primary_wallet text,
  add column if not exists verify_nonce text;

-- 署名検証・保存はユーザー本人のみ（RLSが既にonの前提）
-- 既存のRLSポリシー（user_id = auth.uid()）が機能していれば新規追加不要
-- 念のため profiles の auth ポリシーがあるか確認し、無ければ追加してください（例）:
-- create policy if not exists allow_update_own_profile
--   on public.profiles
--   for update to authenticated
--   using (user_id = auth.uid())
--   with check (user_id = auth.uid());
