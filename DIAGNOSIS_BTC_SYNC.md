# 本番vs開発環境 BTC同期問題の診断手順

## 現状
- ✅ 本番環境: BTCトランザクション取得成功
- ❌ 開発環境: BTCトランザクション0件（Tatum API 200 OK、空配列）

## 調査項目

### 1. 本番環境のログを確認

**Supabase Dashboard - 本番環境ログ**:
https://supabase.com/dashboard/project/ymddtgbsybvxfitgupqy/logs/edge-functions

**確認事項**:
- 本番環境で実際にBTCアドレス同期時のログ
- `[Tatum BTC]` で検索
- Response data lengthが0以上か
- どのエンドポイントを使用しているか

### 2. Edge Functionバージョン確認

**本番環境**:
https://supabase.com/dashboard/project/ymddtgbsybvxfitgupqy/functions/sync-wallet-transactions

**開発環境**:
https://supabase.com/dashboard/project/yelkjimxejmrkfzeumos/functions/sync-wallet-transactions

**確認事項**:
- デプロイ日時
- バージョン番号
- コードサイズ（本番: 52.69kB、開発: 53.06kB ← 若干異なる）

### 3. 環境変数の違い

**本番環境 Secrets**:
https://supabase.com/dashboard/project/ymddtgbsybvxfitgupqy/settings/functions

**開発環境 Secrets**:
https://supabase.com/dashboard/project/yelkjimxejmrkfzeumos/settings/functions

**確認事項**:
- `TATUM_API_KEY` の値（異なるAPIキーを使用している可能性）
- 本番キー: Mainnet対応、有料プラン
- 開発キー: Testnet専用、無料プラン（制限あり）

### 4. Tatum APIキープランの確認

https://dashboard.tatum.io/

**確認手順**:
1. 本番環境のAPIキーでログイン
2. Plan Detailsを確認 → どのエンドポイントが使えるか
3. 開発環境のAPIキーでログイン
4. Plan Detailsを確認

**可能性**:
- 開発環境のAPIキーで `/bitcoin/transaction/address/{address}` エンドポイントが制限されている
- 本番環境では別のプラン/別のエンドポイントを使用

### 5. 直接API呼び出しテスト

**Curlで本番APIキーテスト**:
```bash
curl -X GET "https://api.tatum.io/v3/bitcoin/transaction/address/bc1qcnuh8zydq8y55tnwn3dpwqs2p64zu9cvapkx8c?pageSize=5" \
  -H "x-api-key: <本番のTATUM_API_KEY>"
```

**Curlで開発APIキーテスト**:
```bash
curl -X GET "https://api.tatum.io/v3/bitcoin/transaction/address/bc1qcnuh8zydq8y55tnwn3dpwqs2p64zu9cvapkx8c?pageSize=5" \
  -H "x-api-key: <開発のTATUM_API_KEY>"
```

**比較**:
- 本番キー: 正常にトランザクション配列が返る
- 開発キー: 空配列`[]`が返る → APIキーの違いが原因

## 予想される原因

### 最有力: APIキープランの違い
- 本番環境: Paid plan（全エンドポイント利用可能）
- 開発環境: Free plan（一部エンドポイント制限）

### 対応策

1. **同じAPIキーを使用** (簡単)
   - 開発環境のTATUM_API_KEYを本番と同じにする

2. **Blockstream API使用** (APIキー不要)
   - 無料、制限なし
   - エンドポイント: `https://blockstream.info/api/address/{address}/txs`

3. **開発環境用の有料プラン契約**
   - Tatum有料プランを開発用にも契約
