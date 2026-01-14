-- supabase/migrations/20251204_add_connection_name.sql

-- ユーザーが接続に名前を付けられるように、新しいカラムを追加します。
ALTER TABLE public.exchange_connections
ADD COLUMN IF NOT EXISTS connection_name TEXT;

-- 既存のデータにデフォルト名を設定します（取引所名をそのまま使用）。
UPDATE public.exchange_connections
SET connection_name = exchange
WHERE connection_name IS NULL;

-- 今後、この名前は必須項目とします。
ALTER TABLE public.exchange_connections
ALTER COLUMN connection_name SET NOT NULL;

-- これまでの「ユーザーごと、取引所ごと」の重複禁止ルールを削除します。
-- 注意: この制約名は環境によって異なる場合があります。エラーが出る場合は、Supabaseダッシュボードから手動で削除してください。
ALTER TABLE public.exchange_connections DROP CONSTRAINT IF EXISTS exchange_connections_user_id_exchange_key;

-- 新しく「ユーザーごと、接続名ごと」の重複禁止ルールを設定します。
-- これにより、ユーザーは同じ名前の接続を複数作成できなくなります。
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_connection_name') THEN
        ALTER TABLE public.exchange_connections
        ADD CONSTRAINT unique_user_connection_name UNIQUE (user_id, connection_name);
    END IF;
END $$;

