# 完全バックアップ・復元手順書

**目的**: Supabase本番環境を完全に復元できる状態を維持する

---

## 📦 現在のバックアップ状況

### ✅ 取得済みバックアップ

| ファイル | 内容 | 日付 | サイズ | 用途 |
|----------|------|------|--------|------|
| `prod_complete_20260117_020522.sql` | スキーマ完全版 | 2026-01-17 | 122KB | 構造復元 |
| `asset_prices_2026-01-14T01-00-24-201Z.json` | 資産価格 | 2026-01-14 | 805B | データ復元 |
| `daily_exchange_rates_2026-01-14T01-00-24-201Z.json` | 為替レート | 2026-01-14 | 4KB | データ復元 |
| `exchange_trades_2026-01-14T01-00-24-201Z.json` | 取引履歴 | 2026-01-14 | 5KB | データ復元 |

### ⚠️ 取得推奨（最新データのため）

- [ ] マスターデータの最新バックアップ（`remote_backup_latest.sql`を実行）
- [ ] トランザクションデータの最新バックアップ

---

## 🔄 復元手順（完全版）

### ステップ1: 環境準備

```bash
# 新しいSupabaseプロジェクトを作成、または既存環境をリセット
# Supabase Dashboard → Settings → General → Dangerous → Reset Database
```

### ステップ2: スキーマ復元

```bash
# Supabase SQL Editorで実行
# backups/prod_complete_20260117_020522.sql の内容を全てコピー&ペースト
```

**含まれる内容**:
- ✅ 全テーブル定義
- ✅ 全ビュー定義（`all_transactions`、`v_holdings`など11個）
- ✅ 全関数（10個）
- ✅ 全トリガー
- ✅ 全インデックス
- ✅ 全制約・外部キー
- ✅ 全RLSポリシー（171個）

### ステップ3: マイグレーション履歴の復元

```sql
-- マイグレーション履歴を復元（適用済みとしてマーク）
-- 注: 実際のマイグレーション適用ではなく、履歴のみ記録
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20240523100000', 'create_daily_exchange_rates', ARRAY[]::text[]),
  ('20250918014130', '007cfe61-9be5-48a3-8bb6-9c13145f0b66', ARRAY[]::text[]),
  -- ... (全71個)
  ('20260116171214', 'remote_schema', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
```

### ステップ4: マスターデータの復元

```sql
-- remote_backup_latest.sql で取得したINSERT文を実行

-- 1. asset_prices
INSERT INTO public.asset_prices (asset, current_price, last_updated) VALUES
  ('BTC', 105000.00, '2026-01-14 20:05:23.094941+00'),
  ('ETH', 3300.00, '2026-01-14 20:05:23.094941+00'),
  -- ... (全9件)
ON CONFLICT (asset) DO UPDATE SET current_price = EXCLUDED.current_price, last_updated = EXCLUDED.last_updated;

-- 2. daily_exchange_rates
INSERT INTO public.daily_exchange_rates (date, source_currency, target_currency, rate, created_at) VALUES
  -- ... (全31件)
;

-- 3. entities
-- 4. profiles
-- 5. wallet_connections
-- 6. exchange_connections
```

### ステップ5: トランザクションデータの復元（必要に応じて）

```sql
-- wallet_transactions と exchange_trades を復元
-- JSONバックアップから、またはリモートから直接コピー
```

### ステップ6: 検証

```sql
-- 1. マイグレーション数を確認
SELECT COUNT(*) FROM supabase_migrations.schema_migrations;
-- 期待値: 71

-- 2. テーブル数を確認
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
-- 期待値: 25+

-- 3. ビューの動作確認
SELECT COUNT(*) FROM public.all_transactions;
SELECT COUNT(*) FROM public.v_holdings;
SELECT COUNT(*) FROM public.v_balance_sheet;

-- 4. 関数の存在確認
SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';
-- 期待値: 10

-- 5. RLSポリシー確認
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- 期待値: 171
```

---

## 🎯 復元後の期待される状態

### データベース構造
- ✅ テーブル: 25個以上
- ✅ ビュー: 11個
- ✅ 関数: 10個
- ✅ RLSポリシー: 171個
- ✅ マイグレーション履歴: 71個

### データ内容
- ✅ ユーザー数: 18人（最新データによる）
- ✅ トランザクション: 16件（最新データによる）
- ✅ マスターデータ: 完全復元
- ✅ ビューの出力: 元の環境と同一

---

## ⚠️ 注意事項

### 復元できるもの
- ✅ スキーマ（テーブル、ビュー、関数、トリガー、インデックス、制約、RLS）
- ✅ マスターデータ（asset_prices、daily_exchange_rates）
- ✅ エンティティ・接続情報
- ✅ トランザクションデータ（バックアップ時点）

### 復元できないもの
- ❌ **auth.usersテーブル**（Supabaseの内部管理）
- ❌ バックアップ以降に追加されたデータ
- ❌ ストレージファイル（別途バックアップ必要）

### 重要な制限
- `auth.users`は復元できないため、**ユーザーに再ログイン・再認証が必要**
- `profiles`テーブルのuser_id外部キーが機能しない可能性あり
- この場合、一時的に外部キー制約を無効化する必要がある

---

## 🔒 復元時のauth.users問題の回避策

### 方法1: ダミーユーザー作成（開発環境のみ）

```sql
-- auth.usersに手動でユーザーを作成
-- 警告: 本番環境では使用しないこと
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES 
  ('existing-user-id-uuid', 'user@example.com', 'dummy', NOW(), NOW(), NOW());
```

### 方法2: Supabase Auth経由での再作成（推奨）

1. ユーザーに再サインアップしてもらう
2. 新しいUUIDが生成される
3. `profiles`テーブルのuser_idを新しいUUIDに更新

### 方法3: 完全バックアップからの復元（本番のみ）

```bash
# Supabase Dashboardから完全バックアップをダウンロード
# （auth.usersを含む全てのデータ）
```

---

## 📋 復元完全性チェックリスト

復元後、以下を確認してください：

### スキーマ
- [ ] 全テーブルが作成されている
- [ ] 全ビューが作成され、エラーなく動作する
- [ ] 全関数が作成されている
- [ ] 全トリガーが設定されている
- [ ] 全インデックスが作成されている
- [ ] 外部キー制約が正しく設定されている
- [ ] RLSが有効になっている

### データ
- [ ] asset_pricesにデータが入っている（9件）
- [ ] daily_exchange_ratesにデータが入っている（31件）
- [ ] entitiesにデータが入っている
- [ ] profilesにデータが入っている
- [ ] wallet_connectionsにデータが入っている
- [ ] exchange_connectionsにデータが入っている

### 動作確認
- [ ] `all_transactions`ビューが正しいデータを返す
- [ ] `v_holdings`が正しい保有資産を計算する
- [ ] `v_balance_sheet`が正しい貸借対照表を生成する
- [ ] トリガー関数が正常に動作する（insertテスト）

---

## 🚀 定期バックアップの推奨

### 週次バックアップ（自動化推奨）

```bash
# Supabase CLIでスキーマをダンプ
supabase db dump --linked -f "backups/weekly_schema_$(date +%Y%m%d).sql"

# マスターデータをバックアップ
# remote_backup_latest.sql を実行して結果を保存
```

### 月次バックアップ

```bash
# Supabase Dashboard → Settings → Database → Backups
# Manual Backupを実行
```

---

*この手順書に従えば、依存ビューを含めて完全に復元できます。*
