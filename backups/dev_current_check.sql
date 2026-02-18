SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict rkUoh6N058LHEd2qMhgac76xI3pyUy7bQlKvZNFuz4LW6kHiVek9nAIcBFCtES1

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'authenticated', 'authenticated', 'freeedaze@gmail.com', '$2a$10$1IBxXJoCCYgUh4gAXl5dEexJQE718016SFPexVc9e3WJV3uBlllGa', '2026-01-16 16:14:23.494864+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-01-16 16:14:23.503435+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "ef6c4e6b-e3bb-40ed-b959-2edf08edb208", "email": "freeedaze@gmail.com", "email_verified": true, "phone_verified": false}', NULL, '2026-01-16 16:14:23.454845+00', '2026-01-16 16:14:23.515191+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', '{"sub": "ef6c4e6b-e3bb-40ed-b959-2edf08edb208", "email": "freeedaze@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-16 16:14:23.482057+00', '2026-01-16 16:14:23.48328+00', '2026-01-16 16:14:23.48328+00', 'e8630964-0fad-44bb-93cd-df82387d2a96');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('f1d11ff4-e23b-47e1-bf03-97e680378828', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', '2026-01-16 16:14:23.503569+00', '2026-01-16 16:14:23.503569+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '108.61.182.11', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('f1d11ff4-e23b-47e1-bf03-97e680378828', '2026-01-16 16:14:23.515797+00', '2026-01-16 16:14:23.515797+00', 'password', 'a4fc620d-8a98-42a9-b1b3-15ad93bb1c17');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 103, '45gy7uabiwiv', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', false, '2026-01-16 16:14:23.511152+00', '2026-01-16 16:14:23.511152+00', NULL, 'f1d11ff4-e23b-47e1-bf03-97e680378828');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: asset_prices; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."asset_prices" ("asset", "current_price", "last_updated") VALUES
	('AVAX', 48.00, '2026-01-16 15:52:23.194663+00'),
	('BNB', 660.00, '2026-01-16 15:52:23.194663+00'),
	('MATIC', 1.25, '2026-01-16 15:52:23.194663+00'),
	('USDC', 1.00, '2026-01-16 15:52:23.194663+00'),
	('USDT', 1.00, '2026-01-16 15:52:23.194663+00'),
	('SOL', 155.0, '2026-01-16 15:52:31.249152+00'),
	('BTC', 98000.0, '2026-01-16 15:52:31.249152+00'),
	('ETH', 3500.0, '2026-01-16 15:52:31.249152+00');


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: crypto_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: daily_exchange_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."daily_exchange_rates" ("date", "source_currency", "target_currency", "rate", "created_at") VALUES
	('2025-11-26', 'ETH', 'USD', 3500.00, '2026-01-16 15:52:20.784703+00'),
	('2025-11-26', 'BTC', 'USD', 95000.00, '2026-01-16 15:52:20.784703+00'),
	('2025-11-26', 'MATIC', 'USD', 1.20, '2026-01-16 15:52:20.784703+00'),
	('2025-11-26', 'USDC', 'USD', 1.00, '2026-01-16 15:52:20.784703+00'),
	('2025-11-26', 'USDT', 'USD', 1.00, '2026-01-16 15:52:20.784703+00'),
	('2025-11-26', 'AVAX', 'USD', 45.00, '2026-01-16 15:52:20.784703+00'),
	('2025-11-26', 'BNB', 'USD', 650.00, '2026-01-16 15:52:20.784703+00'),
	('2025-12-07', 'ETH', 'USD', 3600.00, '2026-01-16 15:52:20.784703+00'),
	('2025-12-07', 'BTC', 'USD', 98000.00, '2026-01-16 15:52:20.784703+00'),
	('2025-12-07', 'MATIC', 'USD', 1.25, '2026-01-16 15:52:20.784703+00'),
	('2025-12-07', 'USDC', 'USD', 1.00, '2026-01-16 15:52:20.784703+00'),
	('2025-12-07', 'USDT', 'USD', 1.00, '2026-01-16 15:52:20.784703+00'),
	('2025-12-07', 'AVAX', 'USD', 48.00, '2026-01-16 15:52:20.784703+00'),
	('2025-12-07', 'BNB', 'USD', 660.00, '2026-01-16 15:52:20.784703+00'),
	('2025-11-26', 'USD', 'JPY', 151.50, '2026-01-16 15:52:22.130585+00'),
	('2025-11-26', 'USD', 'EUR', 0.95, '2026-01-16 15:52:22.130585+00'),
	('2025-11-26', 'USD', 'GBP', 0.79, '2026-01-16 15:52:22.130585+00'),
	('2025-11-26', 'USD', 'INR', 84.10, '2026-01-16 15:52:22.130585+00'),
	('2025-11-26', 'USD', 'SGD', 1.34, '2026-01-16 15:52:22.130585+00'),
	('2025-12-07', 'USD', 'JPY', 152.00, '2026-01-16 15:52:22.130585+00'),
	('2025-12-07', 'USD', 'EUR', 0.94, '2026-01-16 15:52:22.130585+00'),
	('2025-12-07', 'USD', 'GBP', 0.78, '2026-01-16 15:52:22.130585+00'),
	('2025-12-07', 'USD', 'INR', 84.20, '2026-01-16 15:52:22.130585+00'),
	('2025-12-07', 'USD', 'SGD', 1.35, '2026-01-16 15:52:22.130585+00');


--
-- Data for Name: entities; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."entities" ("id", "user_id", "name", "type", "parent_id", "is_default", "country", "currency", "created_at", "updated_at", "is_head_office") VALUES
	('317d210f-7eba-420b-ac74-427e1806a088', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'AA', 'personal', NULL, false, NULL, 'USD', '2026-01-16 16:14:36.360735+00', '2026-01-16 16:14:36.360735+00', true);


--
-- Data for Name: exchange_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."exchange_connections" ("id", "user_id", "exchange", "connection_name", "api_key", "api_secret", "encrypted_blob", "label", "status", "external_user_id", "oauth_access_token", "oauth_refresh_token", "oauth_provider", "created_at", "updated_at", "entity_id") VALUES
	(1, 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'binance', 'binance', NULL, NULL, 'v1:Z4MN3oSa323j7hEv:iujs3xmwML6Os54IYWflQL65P2glvfjQukpwkB466RdZwYqleZYfIVPxk0pLXVzNKDgpv0R5e6Jc+rzVDr0QJBSltWugKcVR6+0pqrcVIexmLrCQ3ScEVhwKXyX7l1W8GOoGgJk5SvdKSI8kh03RrzMKPehXR8VW6iED9PBQnQxyt69JiUERzNNA9RAeZUNfIkWAe/inTPYVM/DudMGpvlthWcBf+MPg68ePMQ==', NULL, 'active', NULL, NULL, NULL, NULL, '2026-01-16 16:17:18.621685+00', '2026-01-16 16:17:18.621685+00', '317d210f-7eba-420b-ac74-427e1806a088');


--
-- Data for Name: exchange_trades; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."exchange_trades" ("id", "user_id", "exchange", "trade_id", "symbol", "side", "price", "amount", "fee", "fee_asset", "ts", "raw_data", "created_at", "value_usd", "fee_currency", "usage", "note", "exchange_connection_id") VALUES
	(1, 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'binance', 'N01707931760881157120011443', 'SOL/JPY', 'buy', 23601.32639454, 0.0423705, 0, NULL, '2026-01-14 13:37:14+00', '{"price": "23601.32639454", "status": "Completed", "orderNo": "N01707931760881157120011443", "totalFee": "0.0", "createTime": "1768397834000", "updateTime": "1768397840000", "fiatCurrency": "JPY", "obtainAmount": "0.0423705", "sourceAmount": "1000.0", "cryptoCurrency": "SOL", "transactionType": "0"}', '2026-01-16 16:17:39.421642+00', NULL, 1000, NULL, NULL, 1),
	(2, 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'binance', 'N01707833880019331072011443', 'BTC/JPY', 'buy', 15569048.73112253, 0.00012846, 0, NULL, '2026-01-14 07:08:17+00', '{"price": "15569048.73112253", "status": "Completed", "orderNo": "N01707833880019331072011443", "totalFee": "0.0", "createTime": "1768374497000", "updateTime": "1768374504000", "fiatCurrency": "JPY", "obtainAmount": "0.00012846", "sourceAmount": "2000.0", "cryptoCurrency": "BTC", "transactionType": "0"}', '2026-01-16 16:17:39.421642+00', NULL, 2000, NULL, NULL, 1),
	(3, 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'binance', 'N01690220515981697024112643', 'ETH/JPY', 'buy', 475615.2082719, 0.00210254, 0, NULL, '2025-11-26 16:39:04+00', '{"price": "475615.2082719", "status": "Completed", "orderNo": "N01690220515981697024112643", "totalFee": "0.0", "createTime": "1764175144000", "updateTime": "1764175151000", "fiatCurrency": "JPY", "obtainAmount": "0.00210254", "sourceAmount": "1000.0", "cryptoCurrency": "ETH", "transactionType": "0"}', '2026-01-16 16:17:39.421642+00', NULL, 1000, NULL, NULL, 1),
	(4, 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'binance', 'N01690182701642582016112643', 'BTC/JPY', 'buy', 14027212.79281807, 0.00021387, 0, NULL, '2025-11-26 14:08:48+00', '{"price": "14027212.79281807", "status": "Completed", "orderNo": "N01690182701642582016112643", "totalFee": "0.0", "createTime": "1764166128000", "updateTime": "1764166134000", "fiatCurrency": "JPY", "obtainAmount": "0.00021387", "sourceAmount": "3000.0", "cryptoCurrency": "BTC", "transactionType": "0"}', '2026-01-16 16:17:39.421642+00', NULL, 3000, NULL, NULL, 1),
	(5, 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'binance', 'N02694167061605595136120743', 'BTC/JPY', 'sell', 13430387.53331966, 1200, 110, NULL, '2025-12-07 14:01:13+00', '{"price": "13430387.53331966", "status": "Completed", "orderNo": "N02694167061605595136120743", "totalFee": "110.0", "createTime": "1765116073000", "updateTime": "1765116110000", "fiatCurrency": "JPY", "obtainAmount": "0.00009754", "sourceAmount": "1200.0", "cryptoCurrency": "BTC", "transactionType": "1"}', '2026-01-16 16:17:39.421642+00', NULL, 0.00009754, NULL, NULL, 1),
	(6, 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'binance', '06fdf4fadda64fb8b483a2d6b71daddd', 'ETH', 'withdrawal', 0, 0.0018, 0.0002, NULL, '2025-11-26 16:42:13+00', '{"id": "06fdf4fadda64fb8b483a2d6b71daddd", "fee": {"cost": 0.0002, "currency": "ETH"}, "info": {"id": "06fdf4fadda64fb8b483a2d6b71daddd", "coin": "ETH", "info": "0x28c6c06298d514db089934071355e5743bf21d60,14469402", "txId": "0xeeb844a6ac0e58401d671e84b6d0071ac3c424b4bac6f7dee5a00be9936a7bf8", "type": "withdrawal", "txKey": "", "amount": "0.0018", "status": "6", "address": "0x12d2de3cf273b069752c1e205be56f361a1759ed", "network": "ETH", "applyTime": "2025-11-26 16:42:13", "confirmNo": "128", "walletType": "0", "completeTime": "2025-11-26 16:44:12", "transferType": "0", "transactionFee": "0.0002"}, "txid": "0xeeb844a6ac0e58401d671e84b6d0071ac3c424b4bac6f7dee5a00be9936a7bf8", "type": "withdrawal", "amount": 0.0018, "status": "ok", "address": "0x12d2de3cf273b069752c1e205be56f361a1759ed", "network": "ETH", "currency": "ETH", "datetime": "2025-11-26T16:42:13.000Z", "internal": false, "addressTo": "0x12d2de3cf273b069752c1e205be56f361a1759ed", "timestamp": 1764175333000}', '2026-01-16 16:17:42.601852+00', NULL, NULL, NULL, NULL, 1),
	(7, 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'binance', 'baa4ae6e9aaa4016821ab307a1318e4a', 'BTC', 'withdrawal', 0, 0.000105, 0.000015, NULL, '2026-01-14 07:09:38+00', '{"id": "baa4ae6e9aaa4016821ab307a1318e4a", "fee": {"cost": 0.000015, "currency": "BTC"}, "info": {"id": "baa4ae6e9aaa4016821ab307a1318e4a", "coin": "BTC", "info": "broadcast:bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h", "txId": "ce7da2646a23bd291d40b4464097c25ecb0f299af47cc6fd9ea9969d5235eb87", "type": "withdrawal", "txKey": "", "amount": "0.000105", "status": "6", "address": "bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va", "network": "BTC", "applyTime": "2026-01-14 07:09:38", "confirmNo": "20", "walletType": "0", "completeTime": "2026-01-14 07:16:31", "transferType": "0", "transactionFee": "0.000015"}, "txid": "ce7da2646a23bd291d40b4464097c25ecb0f299af47cc6fd9ea9969d5235eb87", "type": "withdrawal", "amount": 0.000105, "status": "ok", "address": "bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va", "network": "BTC", "currency": "BTC", "datetime": "2026-01-14T07:09:38.000Z", "internal": false, "addressTo": "bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va", "timestamp": 1768374578000}', '2026-01-16 16:17:42.601852+00', NULL, NULL, NULL, NULL, 1);


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: usage_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."usage_categories" ("key", "ifrs_standard", "description") VALUES
	('investment', 'IAS38', '荳闊ｬ菫晄怏・育┌蠖｢雉・肇縲√さ繧ｹ繝医Δ繝・Ν縺ｮ縺ｿ・・),
	('impairment', 'IAS36', '貂帶錐・・AS38繧ｳ繧ｹ繝医Δ繝・Ν蜑肴署・・),
	('inventory_trader', 'IAS2', '騾壼ｸｸ縺ｮ譽壼査・・CNRV・・),
	('inventory_broker', 'IAS2', '繝悶Ο繝ｼ繧ｫ繝ｼ迚ｹ萓具ｼ・VLCS・・),
	('ifrs15_non_cash', 'IFRS15', '髱樒樟驥大ｯｾ萓｡・亥ｾ梧律隲区ｱらｮ｡逅・→騾｣謳ｺ・・),
	('mining', 'Conceptual', '繝槭う繝九Φ繧ｰ蝣ｱ驟ｬ'),
	('staking', 'Conceptual', '繧ｹ繝・・繧ｭ繝ｳ繧ｰ蝣ｱ驟ｬ'),
	('disposal_sale', 'IAS38', '螢ｲ蜊ｴ/髯､蜊ｴ'),
	('revenue', 'IFRS15', '蜿守寢'),
	('expense', 'IAS1', '雋ｻ逕ｨ'),
	('transfer', 'Internal', '謖ｯ譖ｿ'),
	('airdrop', 'Conceptual', '繧ｨ繧｢繝峨Ο繝・・'),
	('payment', 'Financial', '謾ｯ謇・),
	('fee', 'IAS1', '謇区焚譁・),
	('internal', 'Internal', '蜀・Κ遘ｻ蜍・),
	('other', 'Misc', '縺昴・莉・),
	('cash_purchase', NULL, 'Cash Purchase'),
	('fair_value_gain', NULL, 'Fair Value Gain (Year-end)'),
	('fair_value_loss', NULL, 'Fair Value Loss (Year-end)'),
	('impairment_loss', NULL, 'Impairment Loss'),
	('sale_profit', NULL, 'Sale Profit (Realized Gain)'),
	('sale_loss', NULL, 'Sale Loss (Realized Loss)'),
	('staking_rewards', NULL, 'Staking Rewards (Crypto)'),
	('payment_in_crypto', NULL, 'Payment in Crypto');


--
-- Data for Name: journal_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: journal_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: meter_events; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: nonce_store; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: payment_vault_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "user_id", "display_name", "email", "avatar_url", "created_at", "updated_at", "tax_country", "entity_type", "seats_limit", "plan_type", "account_type", "primary_wallet", "verify_nonce", "company_name", "country", "us_entity_type", "state_of_incorporation", "us_state_of_incorporation") VALUES
	('ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', NULL, NULL, NULL, '2026-01-16 16:14:35.143707+00', '2026-01-16 16:14:34.118+00', NULL, 'C-Corp', 1, 'individual_free', 'corporate', NULL, NULL, 'AA', 'usa', 'C-Corp', 'Louisiana', 'Louisiana');


--
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wallet_transactions" ("id", "user_id", "wallet_address", "chain_id", "direction", "tx_hash", "block_number", "timestamp", "from_address", "to_address", "value_wei", "asset_symbol", "raw", "created_at", "usd_value_at_tx", "usage", "note", "chain", "amount", "date", "asset", "value_in_usd", "type", "description", "source", "asset_decimals", "fee", "fee_currency", "nonce", "method_id", "block_timestamp", "status", "metadata", "updated_at", "occurred_at", "fiat_value_usd") VALUES
	(1, 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', '0x12d2de3cf273b069752c1e205be56f361a1759ed', 1, 'out', '0xeeb844a6ac0e58401d671e84b6d0071ac3c424b4bac6f7dee5a00be9936a7bf8', NULL, '2025-11-26 16:42:47+00', NULL, NULL, NULL, 'ETH', '{}', '2026-01-16 16:15:31.124611+00', NULL, NULL, NULL, 'ethereum', 0.0018, '2025-11-26 16:42:47+00', 'ETH', 6.300000, 'WITHDRAWAL', 'ETH transaction', 'wallet', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"provider": "tatum", "chain_type": "evm", "raw_response": {"hash": "0xeeb844a6ac0e58401d671e84b6d0071ac3c424b4bac6f7dee5a00be9936a7bf8", "chain": "ethereum-mainnet", "amount": "0.0018", "address": "0x12d2de3cf273b069752c1e205be56f361a1759ed", "timestamp": 1764175367000, "blockNumber": 23884176, "counterAddress": "0x28c6c06298d514db089934071355e5743bf21d60", "transactionType": "native", "transactionSubtype": "incoming"}}', '2026-01-16 16:15:31.124611+00', '2025-11-26 16:42:47+00', 6.300000);


--
-- Data for Name: transaction_usage_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: transaction_usage_predictions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_monthly_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: wallet_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wallet_connections" ("id", "user_id", "wallet_address", "wallet_type", "wallet_name", "is_primary", "balance_usd", "last_sync_at", "created_at", "updated_at", "verification_status", "verified_at", "verification_signature", "chain_last_synced_at", "chain", "network", "entity_id") VALUES
	('e58b2d3f-e370-4486-a3aa-34c0dfadc2db', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', '0x12d2de3cf273b069752c1e205be56f361a1759ed', 'metamask', '0x12d2...59ed', false, 0.00000000, NULL, '2026-01-16 16:14:56.605663+00', '2026-01-16 16:14:56.605663+00', 'unverified', '2026-01-16 16:14:56.508+00', NULL, '{}', 'ethereum', NULL, '317d210f-7eba-420b-ac74-427e1806a088'),
	('28fd62e9-212b-48f7-a526-c21ce0a318d4', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', '0x2cbc1d1a7184c4595de19ed1151ab383ba924690', 'metamask', '0x2cbc...4690', false, 0.00000000, NULL, '2026-01-16 16:15:09.155297+00', '2026-01-16 16:15:09.155297+00', 'unverified', '2026-01-16 16:15:09.039+00', NULL, '{}', 'ethereum', NULL, '317d210f-7eba-420b-ac74-427e1806a088'),
	('f6d897b8-9095-4dfe-bfef-dcfd5b752c53', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'HLZ8ixJnYpZ4hVxhipkGGgh2QQseePJwGZMRRmKY4pJQ', 'phantom', 'HLZ8ix...4pJQ', false, 0.00000000, NULL, '2026-01-16 16:15:16.467974+00', '2026-01-16 16:15:16.467974+00', 'unverified', '2026-01-16 16:15:16.357+00', NULL, '{}', 'solana', NULL, '317d210f-7eba-420b-ac74-427e1806a088'),
	('40afbcb5-8ded-4af2-94aa-5e0f49288de7', 'ef6c4e6b-e3bb-40ed-b959-2edf08edb208', 'bc1qcnuh8zydq8y55tnwn3dpwqs2p64zu9cvapkx8c', 'bitcoin', 'bc1qcn...kx8c', false, 0.00000000, NULL, '2026-01-16 16:15:23.557434+00', '2026-01-16 16:15:23.557434+00', 'unverified', '2026-01-16 16:15:23.423+00', NULL, '{}', 'bitcoin', NULL, '317d210f-7eba-420b-ac74-427e1806a088');


--
-- Data for Name: wallet_sync_state; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 103, true);


--
-- Name: exchange_connections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."exchange_connections_id_seq"', 1, true);


--
-- Name: exchange_trades_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."exchange_trades_id_seq"', 7, true);


--
-- Name: payment_vault_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."payment_vault_addresses_id_seq"', 1, false);


--
-- Name: transaction_usage_labels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."transaction_usage_labels_id_seq"', 1, false);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."wallet_transactions_id_seq"', 1, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict rkUoh6N058LHEd2qMhgac76xI3pyUy7bQlKvZNFuz4LW6kHiVek9nAIcBFCtES1

RESET ALL;
