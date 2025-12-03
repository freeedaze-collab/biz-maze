
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
  const [rows, setRows] = useState<ExchangeConn[]>([]);
  const [loading, setLoading] = useState(true);

  // 入力欄
  const [exch, setExch] = useState<Exchange>("binance");
  const [accountId, setAccountId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const [busy, setBusy] = useState(false);
  const toast = (msg: string) => alert(msg);

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

  // ID のみ保存
  const onSaveId = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    if (!accountId.trim()) { toast("ID / UID を入力してください。"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("exchange_connections")
      .upsert(
        { user_id: user.id, exchange: exch, external_user_id: accountId.trim(), status: "linked_id" },
        { onConflict: "user_id,exchange" }
      );
    setBusy(false);
    if (error) { console.error(error); toast("Save ID failed: " + error.message); return; }
    toast("ID を保存しました。");
    load();
  };

  // API Keys 保存
  const onSaveKeys = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    if (!apiKey || !apiSecret) { toast("API Key / Secret を入力してください。"); return; }
    if (exch === "okx" && !passphrase) { toast("OKX は Passphrase が必須です。"); return; }

    setBusy(true);
    const { data: sess } = await supabase.auth.getSession();
    const headers = sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {};

    const { error, data } = await supabase.functions.invoke("exchange-save-keys", {
      headers,
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Exchange Connections</h1>
        <div>
            <Link to="/transactionhistory" className="text-sm underline mr-4">Go to Transaction History</Link>
            <Link to="/dashboard" className="text-sm underline">Back to Dashboard</Link>
        </div>
      </div>

      <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
        <div className="font-semibold">API Key / Secret 発行手順</div>
        {/* ... details sections ... */}
      </div>

      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">1) Link ID &amp; Save API Keys</div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={exch} onChange={(e) => setExch(e.target.value as Exchange)} className="border rounded px-2 py-1">
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
            <option value="okx">OKX</option>
          </select>
          <input className="border rounded px-2 py-1 min-w-[220px]" placeholder="取引所の UID / UserID（推奨）" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          <button className="px-3 py-1.5 rounded border" onClick={onSaveId} disabled={busy} title="外部IDのみ保存（オプション）">Save ID</button>
          <div className="basis-full h-0" />
          <input className="border rounded px-2 py-1 min-w-[240px]" placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <input className="border rounded px-2 py-1 min-w-[240px]" placeholder="API Secret" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
          {exch === "okx" && (
            <input className="border rounded px-2 py-1 min-w-[200px]" placeholder="OKX Passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          )}
          <button className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50" onClick={onSaveKeys} disabled={busy}>Save Keys</button>
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Your connections</div>
        {loading ? <div>Loading...</div> : rows.length === 0 ? <div className="text-sm text-muted-foreground">No connections yet.</div> : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="border rounded p-3">
                <div className="font-medium capitalize">{r.exchange}</div>
                <div className="text-xs text-muted-foreground">ext_user: {r.external_user_id ?? "—"} • {r.created_at ?? "—"} • {r.status ?? "active"}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
