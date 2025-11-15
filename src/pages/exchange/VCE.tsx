// src/pages/exchange/VCE.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const [rows, setRows] = useState<ExchangeConn[]>([]);
  const [exch, setExch] = useState<Exchange>("binance");
  const [accountId, setAccountId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = (m: string) => alert(m);

  const load = async () => {
    const { data, error } = await supabase
      .from("exchange_connections")
      .select("id,user_id,exchange,external_user_id,created_at,status")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setRows((data as any) ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const onSaveId = async () => {
    if (!accountId.trim()) return toast("Enter your exchange UID/UserID.");
    setBusy(true);
    const { error } = await supabase
      .from("exchange_connections")
      .upsert(
        {
          exchange: exch,
          external_user_id: accountId.trim(),
          status: "linked_id",
        } as any,
        { onConflict: "user_id,exchange" }
      );
    setBusy(false);
    if (error) return toast("Save ID failed: " + error.message);
    toast("ID saved.");
    load();
  };

  const onSaveKeys = async () => {
    if (!apiKey || !apiSecret) return toast("Enter API key/secret.");
    if (exch === "okx" && !passphrase) return toast("OKX needs passphrase.");
    setBusy(true);
    const { error } = await supabase.functions.invoke("exchange-save-keys", {
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
      return toast(`Save Keys failed: ${error.message}${details ? `\n\n${details}` : ""}`);
    }
    toast("API keys saved (encrypted server-side).");
    setApiKey(""); setApiSecret(""); setPassphrase("");
    load();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Virtual Custody / Exchanges</h1>
        <Link to="/dashboard" className="text-sm underline">Back to Dashboard</Link>
      </div>

      <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
        <div className="font-semibold">Get API Keys from your exchange</div>
        <p className="text-sm">
          Create read-only API keys. We encrypt & store them on the server with KMS.
        </p>
      </div>

      {/* 1) Link ID & Save API Keys */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">1) Link ID & Save API Keys</div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={exch} onChange={(e)=>setExch(e.target.value as Exchange)} className="border rounded px-2 py-1">
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
            <option value="okx">OKX</option>
          </select>

          <input className="border rounded px-2 py-1 min-w-[220px]" placeholder="Exchange UID / UserID (recommended)" value={accountId} onChange={(e)=>setAccountId(e.target.value)} />
          <button className="px-3 py-1.5 rounded border" onClick={onSaveId} disabled={busy}>Save ID</button>

          <div className="basis-full h-0" />

          <input className="border rounded px-2 py-1 min-w-[240px]" placeholder="API Key" value={apiKey} onChange={(e)=>setApiKey(e.target.value)} />
          <input className="border rounded px-2 py-1 min-w-[240px]" placeholder="API Secret" value={apiSecret} onChange={(e)=>setApiSecret(e.target.value)} />
          {exch === "okx" && (
            <input className="border rounded px-2 py-1 min-w-[200px]" placeholder="OKX Passphrase" value={passphrase} onChange={(e)=>setPassphrase(e.target.value)} />
          )}
          <button className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50" onClick={onSaveKeys} disabled={busy}>
            Save Keys
          </button>
        </div>
      </div>

      {/* Connections */}
      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Your connections</div>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No connections yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="border rounded p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium capitalize">{r.exchange}</div>
                    <div className="text-xs text-muted-foreground">
                      ext_user: {r.external_user_id ?? "—"} • {r.created_at ?? "—"} • {r.status ?? "active"}
                    </div>
                  </div>
                  <Link to="/transactions" className="px-3 py-1.5 rounded border text-xs">
                    Go to Sync (Transactions)
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}