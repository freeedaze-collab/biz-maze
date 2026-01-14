-- supabase/migrations/20251001_rls_policies.sql

-- 有効化：対象テーブル
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- profiles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_authenticated_select_profiles') THEN
        CREATE POLICY "allow_authenticated_select_profiles" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_upsert_own_profile') THEN
        CREATE POLICY "allow_upsert_own_profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_update_own_profile') THEN
        CREATE POLICY "allow_update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    END IF;

    -- wallet_connections
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_select_wallets') THEN
        CREATE POLICY "allow_user_select_wallets" ON public.wallet_connections FOR SELECT TO authenticated USING (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_modify_wallets') THEN
        CREATE POLICY "allow_user_modify_wallets" ON public.wallet_connections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_update_wallets') THEN
        CREATE POLICY "allow_user_update_wallets" ON public.wallet_connections FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    END IF;

    -- transactions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_select_transactions') THEN
        CREATE POLICY "allow_user_select_transactions" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
    END IF;

    -- invoices
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_select_invoices') THEN
        CREATE POLICY "allow_user_select_invoices" ON public.invoices FOR SELECT TO authenticated USING (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_modify_invoices') THEN
        CREATE POLICY "allow_user_modify_invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_update_invoices') THEN
        CREATE POLICY "allow_user_update_invoices" ON public.invoices FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    END IF;

    -- customers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_select_customers') THEN
        CREATE POLICY "allow_user_select_customers" ON public.customers FOR SELECT TO authenticated USING (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_modify_customers') THEN
        CREATE POLICY "allow_user_modify_customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_update_customers') THEN
        CREATE POLICY "allow_user_update_customers" ON public.customers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    END IF;

    -- crypto_payments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_user_select_crypto_payments') THEN
        CREATE POLICY "allow_user_select_crypto_payments" ON public.crypto_payments FOR SELECT TO authenticated USING (user_id = auth.uid());
    END IF;
END $$;
