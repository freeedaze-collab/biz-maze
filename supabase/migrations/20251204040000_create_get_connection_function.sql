
-- supabase/migrations/20251204040000_create_get_connection_function.sql

-- First, drop the old function if it exists, to ensure a clean setup
DROP FUNCTION IF EXISTS get_decrypted_connection(p_user_id uuid, p_exchange text);

-- Then, create the new function that queries the correct decrypted view with its correct name
CREATE OR REPLACE FUNCTION get_decrypted_connection(p_user_id uuid, p_exchange text)
RETURNS TABLE (
  api_key text,
  api_secret text
)
LANGUAGE plpgsql
SECURITY DEFINER
-- ★★★ 正しい「秘密の通路」（復号化済みビュー）の場所を指し示す ★★★
SET search_path = decrypted, public
AS $$
BEGIN
  -- Vaultが提供する復号化済みビューの、正しい名前「decrypted.exchange_connections」を直接参照する。
  -- 私が勝手に追加していた「_decrypted」という接尾辞が、全ての元凶でした。
  RETURN QUERY
  SELECT
    v.api_key,
    v.api_secret
  FROM
    decrypted.exchange_connections AS v -- ここが「exchange_connections_decrypted」ではなく「exchange_connections」だった
  WHERE
    v.user_id = p_user_id AND v.exchange = p_exchange;
END;
$$;
