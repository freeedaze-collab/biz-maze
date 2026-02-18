  -- Insert a new row into public.profiles, copying the id and email
  INSERT INTO public.profiles (user_id, email)
    "inserted_at" timestamp with time zone DEFAULT "now"(),
CREATE OR REPLACE TRIGGER "clear_profile_fields_trigger" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."clear_unused_profile_fields"();
CREATE OR REPLACE TRIGGER "profiles_mirror_id_user_id" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."fn_profiles_mirror_id_user_id"();
CREATE OR REPLACE TRIGGER "trg_profiles_align_ids" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_align_ids"();
CREATE OR REPLACE TRIGGER "trigger_calculate_wallet_tx_usd" BEFORE INSERT OR UPDATE ON "public"."wallet_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_wallet_tx_usd_value"();
CREATE POLICY "Insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can create their own crypto payments" ON "public"."crypto_payments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can create their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can create their own transactions" ON "public"."transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can create their own wallet connections" ON "public"."wallet_connections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can insert their own entities" ON "public"."entities" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "allow_upsert_own_profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_modify_customers" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_modify_invoices" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "allow_user_modify_wallets" ON "public"."wallet_connections" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_insert_customers" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_insert_invoices" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_insert_profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "auth_insert_usage_labels" ON "public"."transaction_usage_labels" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_insert_wallet_tx" ON "public"."wallet_transactions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "auth_insert_wallets" ON "public"."wallet_connections" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "clients_ins_own" ON "public"."clients" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "companies_ins_own" ON "public"."companies" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "cred_upsert_own" ON "public"."exchange_api_credentials" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "customers_ins_own" ON "public"."customers" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "invoices_ins_own" ON "public"."invoices" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "invoices_insert_own" ON "public"."invoices" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "je_ins_owner" ON "public"."journal_entries" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "je_insert_own" ON "public"."journal_entries" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "jl_ins_owner" ON "public"."journal_lines" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
CREATE POLICY "labels_upsert_own" ON "public"."transaction_usage_labels" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "pl_ins_own" ON "public"."payment_links" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "pred_upsert_own" ON "public"."transaction_usage_predictions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "profiles_insert_self_only" ON "public"."profiles" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "tx_insert_self" ON "public"."wallet_transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "tx_usage_ins_owner" ON "public"."transaction_usage_labels" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "vault_ins_own" ON "public"."payment_vault_addresses" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "vce_insert_own" ON "public"."exchange_connections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "wallets upsert own" ON "public"."wallets" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_ins" ON "public"."wallets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_ins_own" ON "public"."wallets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_insert_own" ON "public"."wallets" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "wallets_insert_self" ON "public"."wallets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "wt_insert_own" ON "public"."wallet_transactions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
CREATE POLICY "wtx_insert_own" ON "public"."wallet_transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
