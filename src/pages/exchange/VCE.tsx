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
  external_user_id?: string | null;
  created_at?: string | null;
  status?: string | null;
};

export default function VCE() {
  const { user } = useAuth();

  // 一覧
  const [rows, setRows] = useState<ExchangeConn[]>([]);
  const [loading, setLoading] = useState(true);

  // 1) Link & Save Keys
  const [exch, setExch] = useState<Exchange>("binance");
  const [accountId, setAccountId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState(""); // OKXのみ必須

  // 2) Sync
  const [syncExch, setSyncExch] = useState<Exchange>("binance");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [symbols, setSymbols] = useState("");

  const [busy, setBusy] = useState(false);
  const toast = (m: string) => alert(m);

  // 接続一覧ロード
  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("exchange_connections")
      .select("id,user_id,exchange,external_user_id,created_at,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[vce] list error:", error);
      setRows([]);
    } else {
      setRows((data as any) ?? []);
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 1-a) 外部ID保存
  const onSaveId = async () => {
    if (!user?.id) return toast("Please login again.");
    if (!accountId.trim()) return toast("ID / UID を入力してください。");
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
    if (error) return toast("Save ID failed: " + error.message);
    toast("ID を保存しました。");
    load();
  };

  // 1-b) APIキー保存（Edgeで暗号化）
  const onSaveKeys = async () => {
    if (!user?.id) return toast("Please login again.");
    if (!apiKey || !apiSecret) return toast("API Key / Secret を入力してください。");
    if (exch === "okx" && !passphrase) return toast("OKX は Passphrase が必須です。");
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
    if (error) {
      let details = "";
      try {
        details = await (error as any)?.context?.response?.text?.();
      } catch {}
      console.error("[save-keys]", error, details);
      return toast(`Save Keys failed: ${error.message}${details ? `\n\n${details}` : ""}`);
    }
    console.log("[save-keys] result:", data);
    toast("API Keys を保存しました。（サーバ側で暗号化）");
    setApiKey("");
    setApiSecret("");
    setPassphrase("");
    load();
  };

  // 2) Sync（fetch直叩きで本文を確実に拾う）
  const onSync = async () => {
    if (!user?.id) return toast("Please login again.");
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return toast("No auth token. Please re-login.");

      const base =
        import.meta.env.VITE_SUPABASE_URL ||
        (supabase as any).rest?.url?.replace?.("/rest/v1", "") ||
        "";
      const url = `${base}/functions/v1/exchange-sync`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exchange: syncExch,
          since: since || null,
          until: until || null,
          // 空欄OK：サーバ側で正規化＆フォールバック（ALL/* も可）
          symbols: symbols || null,
        }),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!res.ok || json?.ok === false) {
        console.error("[sync] non-2xx", res.status, json);
        return toast(
          `Sync failed (${res.status})\n` +
            `step: ${json?.step ?? "unknown"}\n` +
            `error: ${json?.details ?? json?.error ?? "unknown"}` +
            `${json?.symbols ? `\nsymbols: ${JSON.stringify(json.symbols)}` : ""}`
        );
      }

      console.log("[sync] ok", json);
      toast(`同期完了: ${json?.inserted ?? 0} 件`);
    } catch (e: any) {
      console.error("[sync] fatal", e);
      toast("Sync failed: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Virtual Custody / Exchanges</h1>
        <Link to="/dashboard" className="text-sm underline">
          Back to Dashboard
        </Link>
      </div>

      {/* ガイド */}
      <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
        <div className="font-semibold">まずは各取引所で API Key / Secret を発行</div>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">Binance の API キー取得手順</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            <li>右上プロフィール → <b>API Management</b> → <b>Create API</b>。</li>
            <li>権限は <b>Enable Reading</b>（読み取りのみ）。<u>取引/出金は無効</u>。</li>
            <li>作成後の <b>API Key / Secret</b> を控える。プロフィールの <b>UID</b> も任意で控える。</li>
          </ol>
        </details>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">Bybit の API キー取得手順</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            <li>右上アイコン → <b>API</b> → <b>Create New Key</b>。</li>
            <li>Key Type: <b>System-generated</b>、権限は <b>Read-only</b>。</li>
          </ol>
        </details>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">OKX の API キー取得手順</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            <li><b>Create V5 API Key</b> → 権限は <b>Read</b>。</li>
            <li><b>Passphrase</b> を作成して必ず控える（UI入力でも必須）。</li>
          </ol>
        </details>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">Sync の指定方法</summary>
          <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
            <li>
              <b>since / until</b> は ISO 文字列（例: <code>2025-01-01T00:00:00Z</code>）か
              unixミリ秒。
            </li>
            <li>
              <b>Binance の symbols</b> は
              <code>BTCUSDT,ETHUSDT</code> のような完全名、または
              <code>BTC, ETH</code> のようにベースだけでもOK（サーバで USDT 現物に展開）。
            </li>
            <li>
              <b>ALL</b> / <b>*</b> で USDT 現物の全シンボルを対象に同期。
              空欄でも動作（人気ペアにフォールバック）。
            </li>
            <li>入金/出金も同時に同期します。</li>
          </ul>
        </details>

        <p className="text-xs text-muted-foreground">
          セキュリティ: API Key/Secret は Edge Functions 側で{" "}
          <code>EDGE_KMS_KEY</code> により暗号化保存されます（読み取り権限のみ付与推奨）。
        </p>
      </div>

      {/* 1) Link & Save Keys */}
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
            placeholder="取引所の UID / UserID（任意だが推奨）"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
          <button
            className="px-3 py-1.5 rounded border"
            onClick={onSaveId}
            disabled={busy}
            title="外部IDのみ保存"
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
      </div>

      {/* 2) Sync */}
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
            className="border rounded px-2 py-1 min-w-[320px]"
            placeholder={
              syncExch === "binance"
                ? "symbols（例: BTCUSDT,ETHUSDT ｜ または BTC,ETH ｜ ALL/* ｜ 空欄可）"
                : "symbols（任意）"
            }
            value={symbols}
            onChange={(e) => setSymbols(e.target.value)}
          />

          <button className="px-3 py-1.5 rounded border" onClick={onSync} disabled={busy}>
            Sync now
          </button>
        </div>

        <ul className="text-xs text-muted-foreground list-disc ml-5">
          <li>
            Binance は <b>空欄OK</b>（サーバ側で人気USDT現物ペアにフォールバック）。
          </li>
          <li>
            <code>BTC, ETH</code> のようにベース指定でもOK（<code>BTCUSDT</code> 等に展開）。
          </li>
          <li>
            <code>ALL</code> / <code>*</code> で USDT 現物の全シンボルを一括同期。
          </li>
          <li>入出金も同時に同期します。</li>
        </ul>
      </div>

      {/* 接続一覧 */}
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
                    onClick={() => {
                      setSyncExch(r.exchange);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
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
