-- ステップ1: 開発環境の完全リセット
-- このスクリプトをSupabase SQL Editorで実行してください
-- URL: https://supabase.com/dashboard/project/yelkjimxejmrkfzeumos/sql/new

-- 警告: これは開発環境のすべてを削除します
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- 権限を再設定
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 完了メッセージ
SELECT 'Schema reset complete. Ready for production schema import.' as status;
