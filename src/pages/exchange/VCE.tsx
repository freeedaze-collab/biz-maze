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

interface SyncState {
  marketsToProcess: string[];
  processedRecords: any[];
  since: number;
}

export default function VCE() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExchangeConn[]>([]);
  const [loading, setLoading] = useState(true);

  const [exch, setExch] = useState<Exchange>("binance");
  const [accountId, setAccountId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const [syncExch, setSyncExch] = useState<Exchange>("binance");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [symbols, setSymbols] = useState("");

  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

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

  // ★★★★★ 最終修正：手動でJSONに変換 ★★★★★
  const onSync = async () => {
    if (!user?.id) { toast("Please login again."); return; }

    setBusy(true);
    setSyncMessage("Sync starting...");

    const { data: sess } = await supabase.auth.getSession();
    const baseHeaders = sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {};

    let currentState: SyncState | null = null;
    let keepGoing = true;
    let finalData = null;
    let totalMarketCount = 0;

    while (keepGoing) {
      try {
        const { error, data } = await supabase.functions.invoke("exchange-sync-all", {
          headers: { ...baseHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ // Manually stringify the body
            exchange: syncExch,
            state: currentState,
          }),
        });

        if (error) throw error;
        
        if (data.status === 'pending') {
          currentState = data.state;
          if (totalMarketCount === 0 && currentState?.marketsToProcess) {
            totalMarketCount = currentState.marketsToProcess.length;
          }
          const processedCount = totalMarketCount - (currentState?.marketsToProcess.length ?? 0);
          setSyncMessage(`Syncing... Processed ${processedCount} of ${totalMarketCount} markets.`);
        } else if (data.status === 'complete') {
          finalData = data;
          keepGoing = false;
        } else {
          throw new Error("Unexpected response from sync function.");
        }
      } catch (error: any) {
        console.error(error);
        toast("Sync failed: " + (error.message || "An unknown error occurred."));
        setSyncMessage("");
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    setSyncMessage("");
    console.log("[sync] result:", finalData);
    toast(`Sync complete! Successfully saved ${finalData?.totalSaved ?? 0} records.`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Virtual Custody / Exchanges</h1>
        <Link to="/dashboard" className="text-sm underline">Back to Dashboard</Link>
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
          <button className="px-3 py-1.5 rounded border" onClick={onSaveId} disabled={busy} title="外部IDのみ保存（オプション）">
            Save ID
          </button>
          <div className="basis-full h-0" />
          <input className="border rounded px-2 py-1 min-w-[240px]" placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <input className="border rounded px-2 py-1 min-w-[240px]" placeholder="API Secret" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
          {exch === "okx" && (
            <input className="border rounded px-2 py-1 min-w-[200px]" placeholder="OKX Passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          )}
          <button className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50" onClick={onSaveKeys} disabled={busy}>
            Save Keys
          </button>
        </div>
      </div>

      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">2) Sync</div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={syncExch} onChange={(e) => setSyncExch(e.target.value as Exchange)} className="border rounded px-2 py-1">
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
            <option value="okx">OKX</option>
          </select>
          <input className="border rounded px-2 py-1 min-w-[210px]" placeholder="since (now unused)" value={since} onChange={(e) => setSince(e.target.value)} />
          <input className="border rounded px-2 py-1 min-w-[210px]" placeholder="until (now unused)" value={until} onChange={(e) => setUntil(e.target.value)} />
          <input className="border rounded px-2 py-1 min-w-[260px]" placeholder="symbols (now unused)" value={symbols} onChange={(e) => setSymbols(e.target.value)} />
          <button className="px-3 py-1.5 rounded border" onClick={onSync} disabled={busy}>Sync now</button>
        </div>
        {syncMessage && <p className="text-sm text-blue-600 font-medium mt-2">{syncMessage}</p>}
        <ul className="text-xs text-muted-foreground list-disc ml-5">
          <li>Sync は、過去90日間の全ての関連データを自動的に取得します。</li>
        </ul>
      </div>

      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Your connections</div>
        {loading ? <div>Loading...</div> : rows.length === 0 ? <div className="text-sm text-muted-foreground">No connections yet.</div> : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="border rounded p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium capitalize">{r.exchange}</div>
                    <div className="text-xs text-muted-foreground">ext_user: {r.external_user_id ?? "—"} • {r.created_at ?? "—"} • {r.status ?? "active"}</div>
                  </div>
                  <button className="px-3 py-1.5 rounded border text-xs" onClick={() => { setSyncExch(r.exchange); window.scrollTo({ top: 0, behavior: "smooth" }); }} title="Sync セクションに移動してこの取引所を選択">
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
