# セッションが `Loading...` のままになる原因の切り分け（手順 1〜3）

> 本ドキュメントは **原因が特定できるまでの追跡手順** です。  
> ここに従って観測し、必ず記録（スクショ/ログ）を残してください。

---

## 手順1：コードログで状況を観測（修正はしない）
### 1-1. Console ログ確認（useAuth）
- 起動直後に DevTools Console を開く
- `getSession() returned:` の出力を確認  
  - `true, <userId>` → セッション復元 OK  
  - `false` → セッション無し（＝Loading... のままの主因）
- `onAuthStateChange:` のイベントも記録  
  - `SIGNED_IN` が発火するか
  - `TOKEN_REFRESHED` が周期的に出ているか

### 1-2. DevAuthPanel で可視化
- 右下の **🩺 DevAuth → open** を押す
- 表示項目：
  - `origin`（アクセスしている URL）
  - `loading`（true/false）
  - `user`（ログイン中の userId／null）
  - `token`（マスク済み。空なら未ログイン）
  - LocalStorage フィルタ一覧（`supabase`, `sb-`, `walletconnect`, `wc@2` など）
  - Cookie 名一覧（値は表示しない）

> ここで **user が null** かつ **token が空**なら、セッションが残っていません。  
> token があるのに user が null の場合、SDK が読めていない可能性があります。

---

## 手順2：ブラウザ側の保持データを点検（修正はしない）
### 2-1. Application タブで確認
- **Local Storage**（`http://localhost:5173`）  
  - `supabase.auth.token`, `sb-******-auth-token` が存在するか
- **Cookies**（`http://localhost:5173`）  
  - `sb-****` 系の Cookie 名が存在するか（値は開示不要）
- **IndexedDB / Cache Storage**（読み取りのみ）
  - WalletConnect のセッションが大量に残っていないか把握だけ

> **消去操作はまだ行わない**でください（現象再現のため）。

---

## 手順3：結果から原因を絞る（修正案はまだ出さない）
### 3-1. よくあるパターンと次アクション
- **A. getSession() が null**  
  - 直近でログインしていない → 一度ログイン→リロード→`getSession()` が true に変わるか再確認
  - Cookie/LocalStorage が**存在しない** → ブラウザが保存を拒否している可能性（シークレット/サードパーティブロック/拡張）
- **B. token はあるのに user が null**  
  - ドメイン/オリジン不整合（`localhost` vs `127.0.0.1` / ポート差違）  
  - BrowserRouter でのパス直打ち時にホスト側が index.html にフォールバックしているか（Vite dev はOK／本番はリライトルール要）
- **C. `onAuthStateChange` が一切出ない**  
  - SDK 初期化前に画面が切り替わる構成か（ただし本プロジェクトは AuthProvider が最上位なので想定外）

> ここまでで得られた **Console ログと DevAuthPanel のスクショ** を開発メモとして残してください。  
> 以後の「修正」は、上記の記録に基づき**ピンポイント**に行います。
