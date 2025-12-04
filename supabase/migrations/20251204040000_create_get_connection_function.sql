
-- supabase/migrations/20251204040000_create_get_connection_function.sql

-- First, drop the old function if it exists, to ensure a clean setup
DROP FUNCTION IF EXISTS get_decrypted_connection(p_user_id uuid, p_exchange text);

-- Then, create the new, fully specified function
CREATE OR REPLACE FUNCTION get_decrypted_connection(p_user_id uuid, p_exchange text)
RETURNS TABLE (
  api_key text,
  api_secret text
)
LANGUAGE plpgsql
SECURITY DEFINER
-- ★★★ 暗号解読器の場所を明記し、セキュリティを強化する最終修正 ★★★
SET search_path = public, pgsodium
AS $$
BEGIN
  -- この関数は、正しい search_path を持つことで、
  -- Supabase Vault が提供する復号化済みビューに正しくアクセスできます。
  RETURN QUERY
  SELECT
    c.api_key,
    c.api_secret
  FROM
    public.exchange_connections AS c
  WHERE
    c.user_id = p_user_id AND c.exchange = p_exchange;
END;
$$;
