# 開発環境を本番環境と完全に同期する手順

## 準備完了ファイル

- ✅ `restore_step1_reset.sql` - 開発環境リセット用
- ✅ `backups/prod_schema_only.sql` (67KB) - 本番スキーマ定義
- ✅ `backups/prod_data_only.sql` (6KB) - 本番データ

## 実行手順

### ステップ1: 開発環境をリセット

**Supabase SQL Editor**: https://supabase.com/dashboard/project/yelkjimxejmrkfzeumos/sql/new

1. `restore_step1_reset.sql` をVS Codeで開く
2. 全内容をコピー（14行）
3. SQL Editorに貼り付けて「RUN」をクリック
4. 成功メッセージ「Schema reset complete」を確認

### ステップ2: 本番スキーマをインポート  

**同じSQL Editorで続けて実行**:

1. `backups/prod_schema_only.sql` をVS Codeで開く
2. 全内容をコピー（67KB, 約1600行）
3. SQL Editorに貼り付けて「RUN」をクリック
4. 完了を待つ（30秒〜1分程度）

### ステップ3: 本番データをインポート

**同じSQL Editorで続けて実行**:

1. `backups/prod_data_only.sql` をVS Codeで開く
2. 全内容をコピー（6KB, 約140行）
3. SQL Editorに貼り付けて「RUN」をクリック
4. 完了を待つ

### ステップ4: 検証

以下のSQLを実行して、全ての重要な要素が存在することを確認：

```sql
-- ビューの確認
SELECT 
    'all_transactions' as view_name,
    EXISTS (SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'public' AND table_name = 'all_transactions') as exists
UNION ALL
SELECT 'v_holdings',
    EXISTS (SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'public' AND table_name = 'v_holdings');

-- テーブルの確認
SELECT 
    'exchange_accounts' as table_name,
    EXISTS (SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'exchange_accounts') as exists
UNION ALL
SELECT 'wallets',
    EXISTS (SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'wallets');
```

全てのresultが`true`であれば、同期完了です！

## トラブルシューティング

### エラーが出た場合

1. エラーメッセージ全体をコピー
2. どのステップで発生したかを確認  
3. エラー内容を共有してください

### ファイルが大きすぎる場合

SQL Editorがファイルサイズ制限エラーを出した場合は、さらに細かく分割します。
