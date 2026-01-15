SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict 7DaecXVHnhRvxkNFRzyypYkM6X0qQt26t7CUs0wMRP0H3leH58LgTqucrcPqOl2

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
	('00000000-0000-0000-0000-000000000000', '2f917916-9053-4fe6-89d9-a0fd0e827275', 'authenticated', 'authenticated', 'vtkanetav@gmail.com', '$2a$10$hKZe/aq.ydrcJMylAsThyurWR0eEBrH/BAid1Av/eBeJwNMmdV5ru', NULL, NULL, '34ef0260ab7155dd104e90dc0f272d9706640b7d6f5eec455688744f', '2025-12-16 05:00:20.621606+00', '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"sub": "2f917916-9053-4fe6-89d9-a0fd0e827275", "email": "vtkanetav@gmail.com", "email_verified": false, "phone_verified": false}', NULL, '2025-12-16 05:00:20.612117+00', '2025-12-16 05:00:20.958071+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'authenticated', 'authenticated', 'freeedaze@gmail.com', '$2a$10$PxjPOrkGmK15FSnJHL3/dOHIZloUHhhWgQxRBcZT6cGXWK20B0rE6', '2025-12-23 16:25:48.00585+00', NULL, '', '2025-12-23 16:24:28.818454+00', '', NULL, '', '', NULL, '2026-01-15 07:33:12.82062+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "21b98c65-ce3e-4a44-99df-d0b31f0d5bfe", "email": "freeedaze@gmail.com", "email_verified": true, "phone_verified": false}', NULL, '2025-12-16 04:53:29.925397+00', '2026-01-15 07:33:12.835126+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', 'authenticated', 'authenticated', 'tomohiro.0203@hotmail.co.jp', '$2a$10$gQOvEjsxcPq9Z71D/LCgk.kyw/W4BOKsWE15HrYW2w1GGqVcBydEC', '2026-01-13 16:10:12.976756+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-01-13 23:23:59.269788+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "ee6659b4-ba0a-4a75-ba37-77a2b16585ea", "email": "tomohiro.0203@hotmail.co.jp", "email_verified": true, "phone_verified": false}', NULL, '2026-01-13 16:10:12.950588+00', '2026-01-13 23:23:59.281163+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'cf2b3e78-43ac-49b6-97e5-3718cec29b40', 'authenticated', 'authenticated', 'tkaneta@akane.waseda.jp', '$2a$10$o4ZxcHh4ygH.ZTJg3EnDmeHB0OU0CvFSznky6L7O2uBANpeonn8lW', '2026-01-13 15:50:46.677905+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-01-13 15:50:46.691673+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "cf2b3e78-43ac-49b6-97e5-3718cec29b40", "email": "tkaneta@akane.waseda.jp", "email_verified": true, "phone_verified": false}', NULL, '2026-01-13 15:50:46.619285+00', '2026-01-13 15:50:46.726302+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'bea18d76-ae5a-47b7-9544-3924b7654db4', 'authenticated', 'authenticated', 'test@example.com', '$2a$10$aeElPuIeCXw/eCQWQyclCeepgYGOM7mWhPPp2T5pA6p0YL1di6bIm', '2026-01-14 07:22:47.809274+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-01-14 07:22:47.830007+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "bea18d76-ae5a-47b7-9544-3924b7654db4", "email": "test@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-01-14 07:22:47.743341+00', '2026-01-14 15:05:21.446927+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('2f917916-9053-4fe6-89d9-a0fd0e827275', '2f917916-9053-4fe6-89d9-a0fd0e827275', '{"sub": "2f917916-9053-4fe6-89d9-a0fd0e827275", "email": "vtkanetav@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2025-12-16 05:00:20.618321+00', '2025-12-16 05:00:20.61837+00', '2025-12-16 05:00:20.61837+00', '9d035685-2981-4bff-b367-d389a8e668b4'),
	('21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '{"sub": "21b98c65-ce3e-4a44-99df-d0b31f0d5bfe", "email": "freeedaze@gmail.com", "email_verified": true, "phone_verified": false}', 'email', '2025-12-16 04:53:30.057711+00', '2025-12-16 04:53:30.057769+00', '2025-12-16 04:53:30.057769+00', '9f990e45-65ff-4087-929b-37845bd0a8f3'),
	('cf2b3e78-43ac-49b6-97e5-3718cec29b40', 'cf2b3e78-43ac-49b6-97e5-3718cec29b40', '{"sub": "cf2b3e78-43ac-49b6-97e5-3718cec29b40", "email": "tkaneta@akane.waseda.jp", "email_verified": false, "phone_verified": false}', 'email', '2026-01-13 15:50:46.666639+00', '2026-01-13 15:50:46.666698+00', '2026-01-13 15:50:46.666698+00', '0642edcd-7874-43cb-9c2e-25f34bf1b62d'),
	('ee6659b4-ba0a-4a75-ba37-77a2b16585ea', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', '{"sub": "ee6659b4-ba0a-4a75-ba37-77a2b16585ea", "email": "tomohiro.0203@hotmail.co.jp", "email_verified": false, "phone_verified": false}', 'email', '2026-01-13 16:10:12.969161+00', '2026-01-13 16:10:12.969211+00', '2026-01-13 16:10:12.969211+00', '998fe12e-a897-4aa7-9d38-c97eab557e08'),
	('bea18d76-ae5a-47b7-9544-3924b7654db4', 'bea18d76-ae5a-47b7-9544-3924b7654db4', '{"sub": "bea18d76-ae5a-47b7-9544-3924b7654db4", "email": "test@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-14 07:22:47.78877+00', '2026-01-14 07:22:47.788827+00', '2026-01-14 07:22:47.788827+00', '845575bb-7f55-45e4-b65c-1bcf04d4895d');


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
	('05f834e1-d781-4cea-9f5d-af6536864f7f', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', '2026-01-13 16:10:12.985317+00', '2026-01-13 23:23:55.765324+00', NULL, 'aal1', NULL, '2026-01-13 23:23:55.764601', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '60.70.170.173', NULL, NULL, NULL, NULL, NULL),
	('a51906c6-24a8-4aba-ac9d-e5908fa4c71e', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', '2026-01-13 23:23:59.269892+00', '2026-01-13 23:23:59.269892+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '60.70.170.173', NULL, NULL, NULL, NULL, NULL),
	('63574a39-f6b2-48ec-9090-a4f49edc93da', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '2026-01-13 23:24:18.829401+00', '2026-01-14 07:21:12.681976+00', NULL, 'aal1', NULL, '2026-01-14 07:21:12.681263', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '203.167.56.164', NULL, NULL, NULL, NULL, NULL),
	('497b6d55-1bce-4fa7-b9ba-6d75ce3a9b7b', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '2026-01-14 07:21:15.817304+00', '2026-01-14 07:21:15.817304+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '203.167.56.164', NULL, NULL, NULL, NULL, NULL),
	('cc2ed105-f29d-4da7-ac8b-18b7e66116ad', 'cf2b3e78-43ac-49b6-97e5-3718cec29b40', '2026-01-13 15:50:46.691793+00', '2026-01-13 15:50:46.691793+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '60.87.156.154', NULL, NULL, NULL, NULL, NULL),
	('0aad1ba4-09ad-4843-9d0e-dbfe7109e5c4', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '2026-01-14 07:45:16.182125+00', '2026-01-14 13:02:37.376775+00', NULL, 'aal1', NULL, '2026-01-14 13:02:37.376657', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '60.70.167.228', NULL, NULL, NULL, NULL, NULL),
	('3fa22c9b-c6f3-4bbf-910d-6e075b93d97e', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '2026-01-14 13:02:43.724058+00', '2026-01-14 14:01:09.496656+00', NULL, 'aal1', NULL, '2026-01-14 14:01:09.49656', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '60.70.167.228', NULL, NULL, NULL, NULL, NULL),
	('df280ddf-2eb2-48ae-a91f-7829af3d1a9a', 'bea18d76-ae5a-47b7-9544-3924b7654db4', '2026-01-14 07:22:47.830127+00', '2026-01-14 15:05:21.452149+00', NULL, 'aal1', NULL, '2026-01-14 15:05:21.452013', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '60.70.167.228', NULL, NULL, NULL, NULL, NULL),
	('f53a69b0-4353-4638-8e02-5f368472088f', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '2026-01-14 14:47:01.901694+00', '2026-01-15 07:33:09.277282+00', NULL, 'aal1', NULL, '2026-01-15 07:33:09.275269', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '203.167.56.164', NULL, NULL, NULL, NULL, NULL),
	('775b7c1e-4f19-4483-8d4a-622650f5d96c', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '2026-01-15 07:33:12.82081+00', '2026-01-15 07:33:12.82081+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '203.167.56.164', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('cc2ed105-f29d-4da7-ac8b-18b7e66116ad', '2026-01-13 15:50:46.727634+00', '2026-01-13 15:50:46.727634+00', 'password', '841f8283-b74d-4e39-813a-933a180ac41f'),
	('05f834e1-d781-4cea-9f5d-af6536864f7f', '2026-01-13 16:10:13.002279+00', '2026-01-13 16:10:13.002279+00', 'password', 'deabc5d3-a317-407e-a4a0-1903e775d98e'),
	('a51906c6-24a8-4aba-ac9d-e5908fa4c71e', '2026-01-13 23:23:59.281568+00', '2026-01-13 23:23:59.281568+00', 'password', '41e5b2b1-cb3d-4695-a26c-76fdc37138a0'),
	('63574a39-f6b2-48ec-9090-a4f49edc93da', '2026-01-13 23:24:18.832761+00', '2026-01-13 23:24:18.832761+00', 'password', '557e0b63-5c7c-4b77-a4cd-a73549e12921'),
	('497b6d55-1bce-4fa7-b9ba-6d75ce3a9b7b', '2026-01-14 07:21:15.83295+00', '2026-01-14 07:21:15.83295+00', 'password', 'fb3490b3-b6b1-45d2-8ee0-099eca957b8f'),
	('df280ddf-2eb2-48ae-a91f-7829af3d1a9a', '2026-01-14 07:22:47.870385+00', '2026-01-14 07:22:47.870385+00', 'password', 'd9fb4581-78aa-4e8d-ba59-709ad525b1ea'),
	('0aad1ba4-09ad-4843-9d0e-dbfe7109e5c4', '2026-01-14 07:45:16.269585+00', '2026-01-14 07:45:16.269585+00', 'password', 'dd36c337-b058-4962-bacf-a0f5fc0a3a1e'),
	('3fa22c9b-c6f3-4bbf-910d-6e075b93d97e', '2026-01-14 13:02:43.750624+00', '2026-01-14 13:02:43.750624+00', 'password', 'b11f2b34-0d83-4d1d-acff-8976092956f4'),
	('f53a69b0-4353-4638-8e02-5f368472088f', '2026-01-14 14:47:01.983096+00', '2026-01-14 14:47:01.983096+00', 'password', '71ce004e-df81-4095-9edc-b33344717a40'),
	('775b7c1e-4f19-4483-8d4a-622650f5d96c', '2026-01-15 07:33:12.835573+00', '2026-01-15 07:33:12.835573+00', 'password', 'e074124f-6c07-4771-a06f-b3dbc997954b');


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

INSERT INTO "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") VALUES
	('e3c840af-c120-43c7-bb0e-ff3f73b74874', '2f917916-9053-4fe6-89d9-a0fd0e827275', 'confirmation_token', '34ef0260ab7155dd104e90dc0f272d9706640b7d6f5eec455688744f', 'vtkanetav@gmail.com', '2025-12-16 05:00:20.959878', '2025-12-16 05:00:20.959878');


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 74, 'p3ewq2niibnc', 'cf2b3e78-43ac-49b6-97e5-3718cec29b40', false, '2026-01-13 15:50:46.708384+00', '2026-01-13 15:50:46.708384+00', NULL, 'cc2ed105-f29d-4da7-ac8b-18b7e66116ad'),
	('00000000-0000-0000-0000-000000000000', 76, '2kqzxh7ybuyq', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', false, '2026-01-13 23:23:55.740746+00', '2026-01-13 23:23:55.740746+00', 'gd4pocf7eqkm', '05f834e1-d781-4cea-9f5d-af6536864f7f'),
	('00000000-0000-0000-0000-000000000000', 77, '7ox36ifjz42s', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', false, '2026-01-13 23:23:59.279996+00', '2026-01-13 23:23:59.279996+00', NULL, 'a51906c6-24a8-4aba-ac9d-e5908fa4c71e'),
	('00000000-0000-0000-0000-000000000000', 78, '7xjxkfo73arr', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', true, '2026-01-13 23:24:18.830486+00', '2026-01-14 07:21:12.619284+00', NULL, '63574a39-f6b2-48ec-9090-a4f49edc93da'),
	('00000000-0000-0000-0000-000000000000', 83, 'kjo6hs4m5mcc', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', true, '2026-01-14 08:46:37.736719+00', '2026-01-14 13:02:37.312297+00', 'ejxjsxhsg4lh', '0aad1ba4-09ad-4843-9d0e-dbfe7109e5c4'),
	('00000000-0000-0000-0000-000000000000', 86, 'v7lfgsqe73wu', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', false, '2026-01-14 14:01:09.486359+00', '2026-01-14 14:01:09.486359+00', '6n2x44j5lle4', '3fa22c9b-c6f3-4bbf-910d-6e075b93d97e'),
	('00000000-0000-0000-0000-000000000000', 81, 'uvigbm2jxh3h', 'bea18d76-ae5a-47b7-9544-3924b7654db4', true, '2026-01-14 07:22:47.849696+00', '2026-01-14 15:05:21.403446+00', NULL, 'df280ddf-2eb2-48ae-a91f-7829af3d1a9a'),
	('00000000-0000-0000-0000-000000000000', 88, '2nkneyl7fzhc', 'bea18d76-ae5a-47b7-9544-3924b7654db4', false, '2026-01-14 15:05:21.428199+00', '2026-01-14 15:05:21.428199+00', 'uvigbm2jxh3h', 'df280ddf-2eb2-48ae-a91f-7829af3d1a9a'),
	('00000000-0000-0000-0000-000000000000', 90, 'qdjx4kk2qzkw', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', false, '2026-01-15 07:33:09.252697+00', '2026-01-15 07:33:09.252697+00', 'ihwbagxrjv77', 'f53a69b0-4353-4638-8e02-5f368472088f'),
	('00000000-0000-0000-0000-000000000000', 91, 'yatrlgw2stqp', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', false, '2026-01-15 07:33:12.830372+00', '2026-01-15 07:33:12.830372+00', NULL, '775b7c1e-4f19-4483-8d4a-622650f5d96c'),
	('00000000-0000-0000-0000-000000000000', 75, 'gd4pocf7eqkm', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', true, '2026-01-13 16:10:12.992323+00', '2026-01-13 23:23:55.72693+00', NULL, '05f834e1-d781-4cea-9f5d-af6536864f7f'),
	('00000000-0000-0000-0000-000000000000', 79, 'vpsbzp6j24f7', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', false, '2026-01-14 07:21:12.644219+00', '2026-01-14 07:21:12.644219+00', '7xjxkfo73arr', '63574a39-f6b2-48ec-9090-a4f49edc93da'),
	('00000000-0000-0000-0000-000000000000', 80, 'lmvfjg7tsoyx', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', false, '2026-01-14 07:21:15.829491+00', '2026-01-14 07:21:15.829491+00', NULL, '497b6d55-1bce-4fa7-b9ba-6d75ce3a9b7b'),
	('00000000-0000-0000-0000-000000000000', 82, 'ejxjsxhsg4lh', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', true, '2026-01-14 07:45:16.232048+00', '2026-01-14 08:46:37.721405+00', NULL, '0aad1ba4-09ad-4843-9d0e-dbfe7109e5c4'),
	('00000000-0000-0000-0000-000000000000', 84, 'rmu225r47356', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', false, '2026-01-14 13:02:37.340248+00', '2026-01-14 13:02:37.340248+00', 'kjo6hs4m5mcc', '0aad1ba4-09ad-4843-9d0e-dbfe7109e5c4'),
	('00000000-0000-0000-0000-000000000000', 85, '6n2x44j5lle4', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', true, '2026-01-14 13:02:43.743157+00', '2026-01-14 14:01:09.469172+00', NULL, '3fa22c9b-c6f3-4bbf-910d-6e075b93d97e'),
	('00000000-0000-0000-0000-000000000000', 87, 'iy2f533ixn25', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', true, '2026-01-14 14:47:01.946286+00', '2026-01-14 15:45:47.995892+00', NULL, 'f53a69b0-4353-4638-8e02-5f368472088f'),
	('00000000-0000-0000-0000-000000000000', 89, 'ihwbagxrjv77', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', true, '2026-01-14 15:45:48.016416+00', '2026-01-15 07:33:09.246636+00', 'iy2f533ixn25', 'f53a69b0-4353-4638-8e02-5f368472088f');


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
	('AVAX', 48.00, '2026-01-10 14:21:08.04587+00'),
	('BNB', 660.00, '2026-01-10 14:21:08.04587+00'),
	('MATIC', 1.25, '2026-01-10 14:21:08.04587+00'),
	('USDC', 1.00, '2026-01-10 14:21:08.04587+00'),
	('USDT', 1.00, '2026-01-10 14:21:08.04587+00'),
	('SOL', 155.0, '2026-01-14 15:44:03.465795+00'),
	('BTC', 98000.0, '2026-01-14 15:44:03.465795+00'),
	('ETH', 3500.0, '2026-01-14 15:44:03.465795+00');


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
	('2025-11-26', 'ETH', 'USD', 3500.00, '2026-01-10 06:23:08.195375+00'),
	('2025-11-26', 'BTC', 'USD', 95000.00, '2026-01-10 06:23:08.195375+00'),
	('2025-11-26', 'MATIC', 'USD', 1.20, '2026-01-10 06:23:08.195375+00'),
	('2025-11-26', 'USDC', 'USD', 1.00, '2026-01-10 06:23:08.195375+00'),
	('2025-11-26', 'USDT', 'USD', 1.00, '2026-01-10 06:23:08.195375+00'),
	('2025-11-26', 'AVAX', 'USD', 45.00, '2026-01-10 06:23:08.195375+00'),
	('2025-11-26', 'BNB', 'USD', 650.00, '2026-01-10 06:23:08.195375+00'),
	('2025-12-07', 'ETH', 'USD', 3600.00, '2026-01-10 06:23:08.195375+00'),
	('2025-12-07', 'BTC', 'USD', 98000.00, '2026-01-10 06:23:08.195375+00'),
	('2025-12-07', 'MATIC', 'USD', 1.25, '2026-01-10 06:23:08.195375+00'),
	('2025-12-07', 'USDC', 'USD', 1.00, '2026-01-10 06:23:08.195375+00'),
	('2025-12-07', 'USDT', 'USD', 1.00, '2026-01-10 06:23:08.195375+00'),
	('2025-12-07', 'AVAX', 'USD', 48.00, '2026-01-10 06:23:08.195375+00'),
	('2025-12-07', 'BNB', 'USD', 660.00, '2026-01-10 06:23:08.195375+00'),
	('2025-11-26', 'USD', 'JPY', 151.50, '2026-01-10 06:38:02.011235+00'),
	('2025-11-26', 'USD', 'EUR', 0.95, '2026-01-10 06:38:02.011235+00'),
	('2025-11-26', 'USD', 'GBP', 0.79, '2026-01-10 06:38:02.011235+00'),
	('2025-11-26', 'USD', 'INR', 84.10, '2026-01-10 06:38:02.011235+00'),
	('2025-11-26', 'USD', 'SGD', 1.34, '2026-01-10 06:38:02.011235+00'),
	('2025-12-07', 'USD', 'JPY', 152.00, '2026-01-10 06:38:02.011235+00'),
	('2025-12-07', 'USD', 'EUR', 0.94, '2026-01-10 06:38:02.011235+00'),
	('2025-12-07', 'USD', 'GBP', 0.78, '2026-01-10 06:38:02.011235+00'),
	('2025-12-07', 'USD', 'INR', 84.20, '2026-01-10 06:38:02.011235+00'),
	('2025-12-07', 'USD', 'SGD', 1.35, '2026-01-10 06:38:02.011235+00');


--
-- Data for Name: entities; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."entities" ("id", "user_id", "name", "type", "parent_id", "is_default", "country", "currency", "created_at", "updated_at", "is_head_office") VALUES
	('f710f14e-fdeb-421a-817a-6fa57b522965', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'AA', 'personal', NULL, false, NULL, 'USD', '2026-01-13 08:57:25.459717+00', '2026-01-13 08:57:25.459717+00', true),
	('99a35e98-62ed-4d9e-bd43-60dc5870fa87', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', 'CA', 'subsidiary', NULL, false, NULL, 'USD', '2026-01-13 16:10:29.232176+00', '2026-01-13 16:10:29.232176+00', false),
	('80235f81-d266-4ffd-9f44-4681e82bcba4', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', 'CB', 'subsidiary', NULL, false, NULL, 'USD', '2026-01-13 16:10:34.458875+00', '2026-01-13 16:10:34.458875+00', false),
	('05cd7d41-75ef-4661-b9f3-77cb8525b097', 'bea18d76-ae5a-47b7-9544-3924b7654db4', 'Test Corp', 'personal', NULL, false, NULL, 'USD', '2026-01-14 07:23:57.785099+00', '2026-01-14 07:23:57.785099+00', true),
	('468e3412-1828-465f-b246-08aa3297d27d', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'AB', 'subsidiary', NULL, false, NULL, 'USD', '2026-01-14 14:48:23.245082+00', '2026-01-14 14:48:23.245082+00', false),
	('9878e76a-b33b-48fe-9adf-2ea455bd1f92', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'AC', 'subsidiary', NULL, false, NULL, 'USD', '2026-01-14 14:48:25.219248+00', '2026-01-14 14:48:25.219248+00', false);


--
-- Data for Name: exchange_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."exchange_connections" ("id", "user_id", "exchange", "connection_name", "api_key", "api_secret", "encrypted_blob", "label", "status", "external_user_id", "oauth_access_token", "oauth_refresh_token", "oauth_provider", "created_at", "updated_at", "entity_id") VALUES
	(2, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'kraken', 'Kraken', NULL, NULL, 'v1:4jZaRWr6CpynjVWU:zIfpIUr0dmT1PAyicSH/c+xpiqsmCXEkDV57uYySjZ2axwMCpQn1SzbvkF4bRrE2Ykb1oaJ4z3U73msvvvPUT5xi98aiQwkvzrKO+zc6bMvaGdTdF65pjL7XeBL43OYaLFgTzSZYxWL5fj7AtnwfvUvLtASGpAYvRQuePpe+NbxSndR2r4Rgw1aQWhmhmQuqp/6FWtHYJbhnlXgCkMAWx5dbFJerF946e6+/d4uL+rgFDvO6AFbLT2IkCBc=', NULL, 'active', NULL, NULL, NULL, NULL, '2026-01-13 10:40:06.135631+00', '2026-01-13 10:40:06.135631+00', 'f710f14e-fdeb-421a-817a-6fa57b522965'),
	(1, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'binance', 'binance', NULL, NULL, 'v1:w5XxL/lR/YpKRoiC:X7yB/tORMmckc3lSWB9LyyGyunBwzr/WqzdLms2JRz1RzgFrk8/zJ5SSs+g2ma05bVePzRoye/65ebyeR3NDEE1hW0QysaVl3WYo95RALyx2C0xjrtfY9iz3LPTSGrsJKA6OYlGeWEgGPJJOHWs5AV6EsMdPKCC6TDWkxa2BBAsW4rEoxQ1e5xasUKn6FkQLkdxoW1aarN/gl2wXq3IOBlf2kkI/YspXe9XOSw==', NULL, 'active', NULL, NULL, NULL, NULL, '2026-01-10 05:46:14.773444+00', '2026-01-10 05:46:14.773444+00', '468e3412-1828-465f-b246-08aa3297d27d');


--
-- Data for Name: exchange_trades; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."exchange_trades" ("id", "user_id", "exchange", "trade_id", "symbol", "side", "price", "amount", "fee", "fee_asset", "ts", "raw_data", "created_at", "usage", "note", "value_usd", "fee_currency", "exchange_connection_id") VALUES
	(29, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'binance', 'N01707931760881157120011443', 'SOL/JPY', 'buy', 23601.32639454, 0.0423705, 0, NULL, '2026-01-14 13:37:14+00', '{"price": "23601.32639454", "status": "Completed", "orderNo": "N01707931760881157120011443", "totalFee": "0.0", "createTime": "1768397834000", "updateTime": "1768397840000", "fiatCurrency": "JPY", "obtainAmount": "0.0423705", "sourceAmount": "1000.0", "cryptoCurrency": "SOL", "transactionType": "0"}', '2026-01-15 07:33:21.610588+00', NULL, NULL, NULL, 1000, 1),
	(30, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'binance', 'N01707833880019331072011443', 'BTC/JPY', 'buy', 15569048.73112253, 0.00012846, 0, NULL, '2026-01-14 07:08:17+00', '{"price": "15569048.73112253", "status": "Completed", "orderNo": "N01707833880019331072011443", "totalFee": "0.0", "createTime": "1768374497000", "updateTime": "1768374504000", "fiatCurrency": "JPY", "obtainAmount": "0.00012846", "sourceAmount": "2000.0", "cryptoCurrency": "BTC", "transactionType": "0"}', '2026-01-15 07:33:21.610588+00', NULL, NULL, NULL, 2000, 1),
	(31, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'binance', 'N01690220515981697024112643', 'ETH/JPY', 'buy', 475615.2082719, 0.00210254, 0, NULL, '2025-11-26 16:39:04+00', '{"price": "475615.2082719", "status": "Completed", "orderNo": "N01690220515981697024112643", "totalFee": "0.0", "createTime": "1764175144000", "updateTime": "1764175151000", "fiatCurrency": "JPY", "obtainAmount": "0.00210254", "sourceAmount": "1000.0", "cryptoCurrency": "ETH", "transactionType": "0"}', '2026-01-15 07:33:21.610588+00', NULL, NULL, NULL, 1000, 1),
	(32, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'binance', 'N01690182701642582016112643', 'BTC/JPY', 'buy', 14027212.79281807, 0.00021387, 0, NULL, '2025-11-26 14:08:48+00', '{"price": "14027212.79281807", "status": "Completed", "orderNo": "N01690182701642582016112643", "totalFee": "0.0", "createTime": "1764166128000", "updateTime": "1764166134000", "fiatCurrency": "JPY", "obtainAmount": "0.00021387", "sourceAmount": "3000.0", "cryptoCurrency": "BTC", "transactionType": "0"}', '2026-01-15 07:33:21.610588+00', NULL, NULL, NULL, 3000, 1),
	(33, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'binance', 'N02694167061605595136120743', 'BTC/JPY', 'sell', 13430387.53331966, 1200, 110, NULL, '2025-12-07 14:01:13+00', '{"price": "13430387.53331966", "status": "Completed", "orderNo": "N02694167061605595136120743", "totalFee": "110.0", "createTime": "1765116073000", "updateTime": "1765116110000", "fiatCurrency": "JPY", "obtainAmount": "0.00009754", "sourceAmount": "1200.0", "cryptoCurrency": "BTC", "transactionType": "1"}', '2026-01-15 07:33:21.610588+00', NULL, NULL, NULL, 0.00009754, 1),
	(34, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'binance', '06fdf4fadda64fb8b483a2d6b71daddd', 'ETH', 'withdrawal', 0, 0.0018, 0.0002, NULL, '2025-11-26 16:42:13+00', '{"id": "06fdf4fadda64fb8b483a2d6b71daddd", "fee": {"cost": 0.0002, "currency": "ETH"}, "info": {"id": "06fdf4fadda64fb8b483a2d6b71daddd", "coin": "ETH", "info": "0x28c6c06298d514db089934071355e5743bf21d60,14469402", "txId": "0xeeb844a6ac0e58401d671e84b6d0071ac3c424b4bac6f7dee5a00be9936a7bf8", "type": "withdrawal", "txKey": "", "amount": "0.0018", "status": "6", "address": "0x12d2de3cf273b069752c1e205be56f361a1759ed", "network": "ETH", "applyTime": "2025-11-26 16:42:13", "confirmNo": "128", "walletType": "0", "completeTime": "2025-11-26 16:44:12", "transferType": "0", "transactionFee": "0.0002"}, "txid": "0xeeb844a6ac0e58401d671e84b6d0071ac3c424b4bac6f7dee5a00be9936a7bf8", "type": "withdrawal", "amount": 0.0018, "status": "ok", "address": "0x12d2de3cf273b069752c1e205be56f361a1759ed", "network": "ETH", "currency": "ETH", "datetime": "2025-11-26T16:42:13.000Z", "internal": false, "addressTo": "0x12d2de3cf273b069752c1e205be56f361a1759ed", "timestamp": 1764175333000}', '2026-01-15 07:33:22.693525+00', NULL, NULL, NULL, NULL, 1),
	(35, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'binance', 'baa4ae6e9aaa4016821ab307a1318e4a', 'BTC', 'withdrawal', 0, 0.000105, 0.000015, NULL, '2026-01-14 07:09:38+00', '{"id": "baa4ae6e9aaa4016821ab307a1318e4a", "fee": {"cost": 0.000015, "currency": "BTC"}, "info": {"id": "baa4ae6e9aaa4016821ab307a1318e4a", "coin": "BTC", "info": "broadcast:bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h", "txId": "ce7da2646a23bd291d40b4464097c25ecb0f299af47cc6fd9ea9969d5235eb87", "type": "withdrawal", "txKey": "", "amount": "0.000105", "status": "6", "address": "bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va", "network": "BTC", "applyTime": "2026-01-14 07:09:38", "confirmNo": "20", "walletType": "0", "completeTime": "2026-01-14 07:16:31", "transferType": "0", "transactionFee": "0.000015"}, "txid": "ce7da2646a23bd291d40b4464097c25ecb0f299af47cc6fd9ea9969d5235eb87", "type": "withdrawal", "amount": 0.000105, "status": "ok", "address": "bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va", "network": "BTC", "currency": "BTC", "datetime": "2026-01-14T07:09:38.000Z", "internal": false, "addressTo": "bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va", "timestamp": 1768374578000}', '2026-01-15 07:33:22.693525+00', NULL, NULL, NULL, NULL, 1);


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: usage_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."usage_categories" ("key", "ifrs_standard", "description") VALUES
	('investment', 'IAS38', '一般保有（無形資産、コストモデルのみ）'),
	('impairment', 'IAS36', '減損（IAS38コストモデル前提）'),
	('inventory_trader', 'IAS2', '通常の棚卸（LCNRV）'),
	('inventory_broker', 'IAS2', 'ブローカー特例（FVLCS）'),
	('ifrs15_non_cash', 'IFRS15', '非現金対価（後日請求管理と連携）'),
	('mining', 'Conceptual', 'マイニング報酬'),
	('staking', 'Conceptual', 'ステーキング報酬'),
	('disposal_sale', 'IAS38', '売却/除却'),
	('revenue', 'IFRS15', '収益'),
	('expense', 'IAS1', '費用'),
	('transfer', 'Internal', '振替'),
	('airdrop', 'Conceptual', 'エアドロップ'),
	('payment', 'Financial', '支払'),
	('fee', 'IAS1', '手数料'),
	('internal', 'Internal', '内部移動'),
	('other', 'Misc', 'その他'),
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
	('21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', NULL, NULL, NULL, '2026-01-13 08:34:43.110303+00', '2026-01-13 08:57:35.981597+00', NULL, 'PC/PA', 1, 'individual_free', 'corporate', NULL, NULL, 'AA', 'usa', 'PC/PA', 'Connecticut', 'Connecticut'),
	('ee6659b4-ba0a-4a75-ba37-77a2b16585ea', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', NULL, NULL, NULL, '2026-01-13 16:10:37.508102+00', '2026-01-13 16:10:37.534+00', NULL, 'C-Corp', 1, 'individual_free', 'corporate', NULL, NULL, 'CC', 'usa', 'C-Corp', 'Indiana', 'Indiana'),
	('bea18d76-ae5a-47b7-9544-3924b7654db4', 'bea18d76-ae5a-47b7-9544-3924b7654db4', NULL, NULL, NULL, '2026-01-14 07:23:57.523146+00', '2026-01-14 07:23:56.871+00', NULL, NULL, 1, 'individual_free', 'corporate', NULL, NULL, 'Test Corp', NULL, NULL, NULL, NULL);


--
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wallet_transactions" ("id", "user_id", "wallet_address", "chain_id", "direction", "tx_hash", "block_number", "timestamp", "from_address", "to_address", "value_wei", "asset_symbol", "raw", "created_at", "usage", "note", "usd_value_at_tx", "chain", "amount", "date", "asset", "value_in_usd", "type", "description", "source", "fee", "fee_currency", "nonce", "method_id", "block_timestamp", "updated_at", "asset_decimals", "status", "metadata", "occurred_at", "fiat_value_usd") VALUES
	(13, '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va', 1, 'in', 'ce7da2646a23bd291d40b4464097c25ecb0f299af47cc6fd9ea9969d5235eb87', NULL, '2026-01-14 07:14:36+00', NULL, NULL, NULL, 'BTC', '{}', '2026-01-15 07:33:36.840467+00', NULL, NULL, NULL, 'bitcoin', 0.000105, '2026-01-14 07:14:36+00', 'BTC', NULL, 'DEPOSIT', 'BTC transaction', 'wallet', NULL, NULL, NULL, NULL, NULL, '2026-01-15 07:33:36.840467+00', NULL, NULL, '{"provider": "tatum", "chain_type": "bitcoin", "raw_response": {"fee": 2865, "hex": "01000000000101316791978c12228e0bbfbf952dc34a9c97ccaab3c2f1f3602b8eadafeea3fd400000000000ffffffff0f125b00000000000016001493469a2758279860c8692a1fca480a01e6e02509042900000000000022512061bfcc272edb4bafa7dd14534b8652e46308682395c00a83a9a8115e4629d876042900000000000017a914c1335865a30177c3e3734ca1350378e79d22798b87ce9e060000000000160014b04b4cf18f3e12a5f2b91af7083759ae4c5a3a6af166010000000000160014a2901c0b69fa2e9d3fe4f4d2ec7af4205f8367a6ec04100000000000225120526ec0c5f5cf4e499f180ad6fb068b86eead40170ae3c26022e821916cad945b444201000000000016001440507d9b65bfa8f55632f22d973661ecaf9f9fbe7c80030000000000160014fa776f1e1b29add2a17fba9d46ad43fe5b538151fae40200000000001976a9145a6a8ec067d6dc593ed3f4d201f49b009bc8179088ac048e0400000000001600147f6e4a688997095c39cd1980d31c1f4ee6394dd30429000000000000160014bdf83a9f9f64a8bc5c3adc8b6ea18fa7cc7c8761ec4dcd110000000017a9143b3c82c204d458a6bf4fd192d836093f8682dbb9872ee6010000000000160014805afa88d3db98b8c9bc459e9858364030d715a3042900000000000016001405d86967f99bf46636887c15d573e537fc9c40994aacf00400000000160014dc6bf86354105de2fcd9868a2b0376d6731cb92f02483045022100bded41e9752b11b7b1095b8459dab13787fd0f81d1a5ec2045443d286d5b59dd022008921542f39ff0ebf8f8c1297d9847dd49baa3908a9d7873b7123da65efd2542012102174ee672429ff94304321cdae1fc1e487edf658b34bd1d36da03761658a2bb0900000000", "hash": "ce7da2646a23bd291d40b4464097c25ecb0f299af47cc6fd9ea9969d5235eb87", "size": 655, "time": 1768374876, "block": "00000000000000000000773a1fcaf5f22fb4afd545d3d57c2fb229cf89748ac9", "index": 158, "vsize": 573, "inputs": [{"coin": {"type": "witness_v0_keyhash", "value": 384117536, "height": 932085, "script": "0014dc6bf86354105de2fcd9868a2b0376d6731cb92f", "address": "bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h", "reqSigs": 1, "version": 1, "coinbase": false}, "script": "", "prevout": {"hash": "40fda3eeafad8e2b60f3f1c2b3aacc979c4ac32d95bfbf0b8e22128c97916731", "index": 0}, "sequence": 4294967295}], "weight": 2290, "outputs": [{"value": 23314, "script": "001493469a2758279860c8692a1fca480a01e6e02509", "address": "bc1qjdrf5f6cy7vxpjrf9g0u5jq2q8nwqfgfkz6cj5", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}, {"value": 10500, "script": "512061bfcc272edb4bafa7dd14534b8652e46308682395c00a83a9a8115e4629d876", "address": "bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va", "scriptPubKey": {"type": "witness_v1_taproot", "reqSigs": null}}, {"value": 10500, "script": "a914c1335865a30177c3e3734ca1350378e79d22798b87", "address": "3KJZr6pFrhNhg9cawDZUACkvsCLrbTGPqX", "scriptPubKey": {"type": "scripthash", "reqSigs": null}}, {"value": 433870, "script": "0014b04b4cf18f3e12a5f2b91af7083759ae4c5a3a6a", "address": "bc1qkp95euv08cf2tu4ertmssd6e4ex95wn2tj8prk", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}, {"value": 91889, "script": "0014a2901c0b69fa2e9d3fe4f4d2ec7af4205f8367a6", "address": "bc1q52gpczmflghf60ly7nfwc7h5yp0cxeax0hlj3m", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}, {"value": 1049836, "script": "5120526ec0c5f5cf4e499f180ad6fb068b86eead40170ae3c26022e821916cad945b", "address": "bc1p2fhvp304ea8yn8ccptt0kp5tsmh26sqhpt3uycpzaqsezm9dj3dsqytxhj", "scriptPubKey": {"type": "witness_v1_taproot", "reqSigs": null}}, {"value": 82500, "script": "001440507d9b65bfa8f55632f22d973661ecaf9f9fbe", "address": "bc1qgpg8mxm9h750243j7gkewdnpajhel8a7qfvs49", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}, {"value": 229500, "script": "0014fa776f1e1b29add2a17fba9d46ad43fe5b538151", "address": "bc1qlfmk78sm9xka9gtlh2w5dt2rled48q23p6kwh5", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}, {"value": 189690, "script": "76a9145a6a8ec067d6dc593ed3f4d201f49b009bc8179088ac", "address": "19F5U24FJqfrwRYXkoTNz877WHUVuo1Wr7", "scriptPubKey": {"type": "pubkeyhash", "reqSigs": 1}}, {"value": 298500, "script": "00147f6e4a688997095c39cd1980d31c1f4ee6394dd3", "address": "bc1q0ahy56yfjuy4cwwdrxqdx8qlfmnrjnwnszzjtt", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}, {"value": 10500, "script": "0014bdf83a9f9f64a8bc5c3adc8b6ea18fa7cc7c8761", "address": "bc1qhhur48ulvj5tchp6mj9kagv05lx8epmpjtr485", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}, {"value": 298667500, "script": "a9143b3c82c204d458a6bf4fd192d836093f8682dbb987", "address": "376EHDwfdaNPeA3NJG4WesYnKBsxVgPhp5", "scriptPubKey": {"type": "scripthash", "reqSigs": null}}, {"value": 124462, "script": "0014805afa88d3db98b8c9bc459e9858364030d715a3", "address": "bc1qspd04zxnmwvt3jdugk0fskpkgqcdw9dr038knk", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}, {"value": 10500, "script": "001405d86967f99bf46636887c15d573e537fc9c4099", "address": "bc1qqhvxjelen06xvd5g0s2a2ul9xl7fcsyea04ef5", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}, {"value": 82881610, "script": "0014dc6bf86354105de2fcd9868a2b0376d6731cb92f", "address": "bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h", "scriptPubKey": {"type": "witness_v0_keyhash", "reqSigs": 1}}], "version": 1, "locktime": 0, "blockNumber": 932217, "witnessHash": "a5fd4ff09e492b5a6cd0d4a77756a8d07e98ee94e9d8a34a4e82fc192bae0a79"}}', '2026-01-14 07:14:36+00', NULL);


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
	('14c1c558-bba6-4166-9a63-611195d21879', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '0x12D2dE3Cf273b069752C1e205bE56f361a1759eD', 'metamask', '0x12D2...59eD', false, 0.00000000, NULL, '2026-01-13 10:33:19.306216+00', '2026-01-13 10:33:19.306216+00', 'unverified', '2026-01-13 10:33:19.183+00', NULL, '{}', 'ethereum', NULL, 'f710f14e-fdeb-421a-817a-6fa57b522965'),
	('69015fd4-00b2-44cb-861e-c853a7e19556', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va', 'bitcoin', 'bc1pvx...m5va', false, 0.00000000, NULL, '2026-01-13 14:21:47.710961+00', '2026-01-13 14:21:47.710961+00', 'unverified', '2026-01-13 14:21:47.603+00', NULL, '{}', 'bitcoin', NULL, 'f710f14e-fdeb-421a-817a-6fa57b522965'),
	('c22327b6-0348-42bc-8267-aefbf4711774', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', '0x12D2dE3Cf273b069752C1e205bE56f361a1759eD', 'metamask', '0x12D2...59eD', false, 0.00000000, NULL, '2026-01-13 16:21:05.054066+00', '2026-01-13 16:21:05.054066+00', 'unverified', '2026-01-13 16:21:04.947+00', NULL, '{}', 'ethereum', NULL, '99a35e98-62ed-4d9e-bd43-60dc5870fa87'),
	('6f1b8c57-45d2-42dd-8c64-e651065ad1af', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', 'HLZ8ixJnYpZ4hVxhipkGGgh2QQseePJwGZMRRmKY4pJQ', 'phantom', 'HLZ8ix...4pJQ', false, 0.00000000, NULL, '2026-01-13 16:21:41.224629+00', '2026-01-13 16:21:41.224629+00', 'unverified', '2026-01-13 16:21:41.123+00', NULL, '{}', 'solana', NULL, '99a35e98-62ed-4d9e-bd43-60dc5870fa87'),
	('9c742896-7189-4536-b731-cf878f560b92', 'ee6659b4-ba0a-4a75-ba37-77a2b16585ea', 'bc1pvxlucfewmd96lf7az3f5hpjju33ss6prjhqq4qaf4qg4u33fmpmq05m5va', 'bitcoin', 'bc1pvx...m5va', false, 0.00000000, NULL, '2026-01-13 16:22:03.013408+00', '2026-01-13 16:22:03.013408+00', 'unverified', '2026-01-13 16:22:02.895+00', NULL, '{}', 'bitcoin', NULL, '99a35e98-62ed-4d9e-bd43-60dc5870fa87'),
	('56f2c6a8-3cea-4b58-af2c-80b98bf544b4', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', '0x2cbc1D1A7184c4595De19Ed1151aB383ba924690', 'metamask', '0x2cbc...4690', false, 0.00000000, NULL, '2026-01-13 10:46:34.954012+00', '2026-01-14 14:48:33.196488+00', 'unverified', '2026-01-13 10:46:34.845+00', NULL, '{}', 'polygon', NULL, '468e3412-1828-465f-b246-08aa3297d27d'),
	('97f0abc9-450b-4cab-8593-b7ae3ce791fa', '21b98c65-ce3e-4a44-99df-d0b31f0d5bfe', 'HLZ8ixJnYpZ4hVxhipkGGgh2QQseePJwGZMRRmKY4pJQ', 'phantom', 'HLZ8ix...4pJQ', false, 0.00000000, NULL, '2026-01-13 10:33:35.399057+00', '2026-01-14 14:49:15.204675+00', 'unverified', '2026-01-13 10:33:35.275+00', NULL, '{}', 'solana', NULL, 'f710f14e-fdeb-421a-817a-6fa57b522965');


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

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 91, true);


--
-- Name: exchange_connections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."exchange_connections_id_seq"', 2, true);


--
-- Name: exchange_trades_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."exchange_trades_id_seq"', 35, true);


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

SELECT pg_catalog.setval('"public"."wallet_transactions_id_seq"', 13, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict 7DaecXVHnhRvxkNFRzyypYkM6X0qQt26t7CUs0wMRP0H3leH58LgTqucrcPqOl2

RESET ALL;
