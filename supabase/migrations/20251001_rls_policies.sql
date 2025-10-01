-- supabase/migrations/20251001_rls_policies.sql

-- 有効化：対象テーブル
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 共通: ログイン済みユーザーのみ
CREATE POLICY "allow_authenticated_select_profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_upsert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- wallet_connections
CREATE POLICY "allow_user_select_wallets"
  ON public.wallet_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_user_modify_wallets"
  ON public.wallet_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_user_update_wallets"
  ON public.wallet_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- transactions（読み取りは本人のみ。書き込みはEdge Function経由を想定）
CREATE POLICY "allow_user_select_transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- invoices
CREATE POLICY "allow_user_select_invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_user_modify_invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_user_update_invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- customers
CREATE POLICY "allow_user_select_customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_user_modify_customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_user_update_customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- crypto_payments（読み取りは本人のみ。送金実行はEdge FunctionのService Roleで）
CREATE POLICY "allow_user_select_crypto_payments"
  ON public.crypto_payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
