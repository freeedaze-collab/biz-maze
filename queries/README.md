# Supabase リモート状態確認クエリ - 実行ガイド

## 📁 クエリファイル一覧

以下のSQLファイルを**順番に**、**一つずつ**Supabase SQL Editorで実行してください。

### 必須クエリ（最重要）

1. **`01_check_migrations.sql`** - マイグレーション履歴確認
   - 実際に適用されているマイグレーションを確認
   - ローカルとの差分を把握

2. **`02_check_table_counts.sql`** - テーブルデータ数確認
   - 各テーブルのレコード数を確認
   - データが正しく入っているか検証

3. **`03_check_views.sql`** - ビュー動作確認
   - 重要なビューがエラーなく動作するか確認

### 詳細確認クエリ

4. **`04_check_table_structure.sql`** - テーブル構造確認
   - カラム名、データ型、デフォルト値を確認
   - ローカル環境との差分を把握

5. **`05_check_foreign_keys.sql`** - 外部キー関係確認
   - テーブル間の参照関係を確認
   - データ投入時のエラー回避

6. **`06_check_view_definitions.sql`** - ビュー定義取得
   - ビューの完全なSQL定義を取得
   - ローカルと比較可能

---

## 🎯 実行方法

### 1. Supabase SQL Editorを開く
本番環境:  
https://supabase.com/dashboard/project/ymddtgbsybvxfitgupqy/sql/new

### 2. 各ファイルを順番に実行

**手順**:
1. `queries/01_check_migrations.sql` を開く
2. 内容をコピー
3. SQL Editorにペースト
4. 実行（Run）
5. **結果をメモ帳などに保存**
6. 次のファイル（`02_check_migrations.sql`）で同じ手順を繰り返す

---

## 📊 期待される結果

### 01_check_migrations.sql
```
version                      | name
----------------------------|---------------------------
20260117021900              | add_prod_columns
20260116020000              | fix_wallet_value_usd
...

total_migrations: 74
```

### 02_check_table_counts.sql
```
table_name           | count
--------------------|-------
asset_prices        | 9
entities            | 2
exchange_trades     | 14
profiles            | 1
wallet_transactions | 2
...
```

### 03_check_views.sql
```
view_name                      | count
------------------------------|-------
all_transactions              | 16
v_all_transactions_classified | 16
v_balance_sheet               | 5
v_holdings                    | 3
...
```

---

## ✅ 確認すべきポイント

### マイグレーション履歴（01）
- [ ] 最新のマイグレーションバージョンを確認
- [ ] ローカルの`supabase/migrations`フォルダと比較
- [ ] 未適用のマイグレーションがないか確認

### テーブルデータ（02）
- [ ] 主要テーブルにデータが入っているか
- [ ] 空のテーブルがあれば理由を確認

### ビュー動作（03）
- [ ] すべてのビューがエラーなく動作しているか
- [ ] カウントが0のビューがあれば原因を確認

### テーブル構造（04）
- [ ] ローカルのスキーマと一致しているか
- [ ] 欠けているカラムや余分なカラムがないか

### 外部キー（05）
- [ ] 期待する参照関係が設定されているか
- [ ] DELETE/UPDATEルールが適切か

---

## 💾 結果の保存

各クエリの結果を以下のような形式で保存してください：

```
backups/
├── remote_status_20260120.txt     # 全クエリ結果をまとめたファイル
└── queries/                        # 個別クエリファイル（このフォルダ）
```

---

## 🔧 トラブルシューティング

### エラー: "permission denied"
→ SQL Editorで実行する際、適切な権限で実行されているか確認

### エラー: "relation does not exist"
→ テーブル名やビュー名が変更されている可能性。クエリ02で存在確認

### 結果が表示されない
→ データが存在しない可能性。WHERE句の条件を確認

---

*これらのクエリを実行することで、Supabase本番環境の完全な状態を把握できます。*
