// src/pages/exchange/VCE.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Exchange = "binance" | "bybit" | "okx";

type ExchangeConn = {
  id: number;
  user_id: string;
  exchange: Exchange;
  external_user_id?: string | null; // 取引所側の UID / UserID など
  created_at?: string | null;
  status?: string | null;           // active | linked_id | linked_keys など
};

export default function VCE() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExchangeConn[]>([]);
  const [loading, setLoading] = useState(true);

  // 入力欄（1. Link & Save Keys）
  const [exch, setExch] = useState<Exchange>("binance");
  const [accountId, setAccountId] = useState("");  // UID / UserID など（任意だが推奨）
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState(""); // OKX のみ必須

  // 入力欄（2. Sync）
  const [syncExch, setSyncExch] = useState<Exchange>("binance");
  const [since, setSince] = useState("");  // ISO 文字列 or unix ms
  const [until, setUntil] = useState("");  // ISO 文字列 or unix ms
  const [symbols, setSymbols] = useState(""); // Binance は必須（"BTCUSDT,ETHUSDT"）

  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("exchange_connections")
      .select("id,user_id,exchange,external_user_id,created_at,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[vce] load error:", error);
      setRows([]);
    } else {
      setRows((data as ExchangeConn[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toast = (msg: string) => alert(msg);

  // 1-a) ID のみ保存（外部 UID ／UserID）
  const onSaveId = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    if (!accountId.trim()) { toast("ID / UID を入力してください。"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("exchange_connections")
      .upsert(
        {
          user_id: user.id,
          exchange: exch,
          external_user_id: accountId.trim(),
          status: "linked_id",
        } as any,
        { onConflict: "user_id,exchange" }
      );
    setBusy(false);
    if (error) { console.error(error); toast("Save ID failed: " + error.message); return; }
    toast("ID を保存しました。");
    load();
  };

  // 1-b) API Keys 保存（Edge Function 経由で暗号化保存）
  const onSaveKeys = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    if (!apiKey || !apiSecret) { toast("API Key / Secret を入力してください。"); return; }
    if (exch === "okx" && !passphrase) { toast("OKX は Passphrase が必須です。"); return; }

    setBusy(true);
    const { error, data } = await supabase.functions.invoke("exchange-save-keys", {
      body: {
        exchange: exch,
        external_user_id: accountId || null,
        apiKey,
        apiSecret,
        passphrase: exch === "okx" ? passphrase : undefined,
      },
    });
    setBusy(false);

    if (error) { console.error(error); toast("Save Keys failed: " + (error.message || "")); return; }
    console.log("[save-keys] result:", data);
    toast("API Keys を保存しました。（サーバ側で暗号化）");
    setApiKey(""); setApiSecret(""); setPassphrase("");
    load();
  };

  // 2) 同期（Edge Function：exchange-sync）
  const onSync = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    if (syncExch === "binance" && !symbols.trim()) {
      toast("Binance は symbols の指定が必須です（例: BTCUSDT,ETHUSDT）。");
      return;
    }
    setBusy(true);
    const { error, data } = await supabase.functions.invoke("exchange-sync", {
      body: {
        exchange: syncExch,
        since: since || null,
        until: until || null,
        symbols: symbols || null,
      },
    });
    setBusy(false);
    if (error) { console.error(error); toast("Sync failed: " + (error.message || "")); return; }
    console.log("[sync] result:", data);
    toast("同期キック完了。完了まで数十秒〜数分かかる場合があります。");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Virtual Custody / Exchanges</h1>
        <Link to="/dashboard" className="text-sm underline">Back to Dashboard</Link>
      </div>

      {/* ====== ガイド（上部に常時表示） ====== */}
      <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
        <div className="font-semibold">まずは API Key / Secret を各取引所で発行します</div>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">Binance の API キー取得手順</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            <li>Binance にログイン → 右上プロフィール → <b>API Management</b>。</li>
            <li><b>Create API</b> → 「System generated」等を選び、任意のラベルを付ける。</li>
            <li>Permissions で <b>Enable Reading（読み取りのみ）</b> を有効化（<u>取引/出金は無効</u>）。</li>
            <li>（任意）IP 制限を有効化する場合は、後で Edge の送信元 IP を追加してください。</li>
            <li>作成後に表示される <b>API Key / Secret Key</b> を控える（Secret は一度しか表示されません）。</li>
            <li>UID（プロフィールの <b>UID</b>）も控えておくと、外部IDとして紐付けできます。</li>
          </ol>
        </details>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">Bybit の API キー取得手順</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            <li>Bybit にログイン → 右上アイコン → <b>API</b>。</li>
            <li><b>Create New Key</b> → Key Type: <b>System-generated</b>、権限は <b>Read-only</b>。</li>
            <li>現物/デリバティブの読み取りを有効化（Trading/Withdrawalは無効）。</li>
            <li>作成後の <b>API Key / Secret</b> を控える。ユーザーの <b>UID</b> も控える。</li>
          </ol>
        </details>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">OKX の API キー取得手順</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            <li>OKX にログイン → 右上プロフィール → <b>API</b> → <b>Create V5 API Key</b>。</li>
            <li>権限は <b>Read</b>（Account / Trading data など読み取り系）を選択。</li>
            <li><b>Passphrase</b> を自分で作成（<u>必ず控える</u>）。</li>
            <li>生成された <b>API Key / Secret Key / Passphrase</b> を控える。<b>UID</b> も控える。</li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            ※ OKX はこのページの入力でも <b>Passphrase</b> が必須です。
          </p>
        </details>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">Sync の指定方法</summary>
          <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
            <li><b>since / until</b> は ISO 文字列（例: <code>2025-01-01T00:00:00Z</code>）か unix ミリ秒。</li>
            <li><b>Binance は symbols が必須</b>（例: <code>BTCUSDT,ETHUSDT</code>）。Bybit / OKX は未指定でも可。</li>
            <li>同期では、トレード・入金・出金・一部残高の取得を行います（段階的拡張）。</li>
          </ul>
        </details>

        <p className="text-xs text-muted-foreground">
          セキュリティ: API Key/Secret は Edge Functions 側で <code>EDGE_KMS_KEY</code> を用いた暗号化で保存されます。
          取引/出金権限は付与しないでください（読み取りのみ）。
        </p>
      </div>

      {/* ===== 1) Link ID & Save API Keys ===== */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">1) Link ID &amp; Save API Keys</div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={exch}
            onChange={(e) => setExch(e.target.value as Exchange)}
            className="border rounded px-2 py-1"
          >
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
            <option value="okx">OKX</option>
          </select>

          <input
            className="border rounded px-2 py-1 min-w-[220px]"
            placeholder="取引所の UID / UserID（推奨）"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
          <button
            className="px-3 py-1.5 rounded border"
            onClick={onSaveId}
            disabled={busy}
            title="外部IDのみ保存（オプション）"
          >
            Save ID
          </button>

          <div className="basis-full h-0" />

          <input
            className="border rounded px-2 py-1 min-w-[240px]"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1 min-w-[240px]"
            placeholder="API Secret"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
          />
          {exch === "okx" && (
            <input
              className="border rounded px-2 py-1 min-w-[200px]"
              placeholder="OKX Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          )}
          <button
            className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={onSaveKeys}
            disabled={busy}
          >
            Save Keys
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          * OKX は <b>passphrase</b> が必須です。保存後、接続のステータスは <code>linked_keys</code> になります。
        </p>
      </div>

      {/* ===== 2) Sync ===== */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">2) Sync</div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={syncExch}
            onChange={(e) => setSyncExch(e.target.value as Exchange)}
            className="border rounded px-2 py-1"
          >
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
            <option value="okx">OKX</option>
          </select>

          <input
            className="border rounded px-2 py-1 min-w-[210px]"
            placeholder="since (ISO or ms)"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1 min-w-[210px]"
            placeholder="until (ISO or ms)"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1 min-w-[260px]"
            placeholder={syncExch === "binance"
              ? "Binance symbols（例: BTCUSDT,ETHUSDT）"
              : "symbols（任意）"}
            value={symbols}
            onChange={(e) => setSymbols(e.target.value)}
          />
          <button
            className="px-3 py-1.5 rounded border"
            onClick={onSync}
            disabled={busy}
          >
            Sync now
          </button>
        </div>

        <ul className="text-xs text-muted-foreground list-disc ml-5">
          <li><b>Binance の約定は symbol が必須</b>です。Bybit/OKX は未指定でも取得可能。</li>
          <li>入出金も同時に同期します。</li>
        </ul>
      </div>

      {/* ===== 一覧 ===== */}
      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Your connections</div>
        {loading ? (
          <div>Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No connections yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="border rounded p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium capitalize">{r.exchange}</div>
                    <div className="text-xs text-muted-foreground">
                      ext_user: {r.external_user_id ?? "—"} • {r.created_at ?? "—"} •{" "}
                      {r.status ?? "active"}
                    </div>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded border text-xs"
                    onClick={() => { setSyncExch(r.exchange); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    title="Sync セクションに移動してこの取引所を選択"
                  >
                    Prepare Sync
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
