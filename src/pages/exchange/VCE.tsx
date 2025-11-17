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
  external_user_id?: string | null; // Exchange-side UID / UserID (optional but recommended)
  created_at?: string | null;
  status?: string | null;           // active | linked_id | linked_keys, etc.
};

export default function VCE() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExchangeConn[]>([]);
  const [loading, setLoading] = useState(true);

  // Section 1: Link ID & Save API Keys
  const [exch, setExch] = useState<Exchange>("binance");
  const [accountId, setAccountId] = useState("");  // UID / UserID (optional but recommended)
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState(""); // OKX only

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

  // 1-a) Save external ID only (Exchange UID / UserID)
  const onSaveId = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    if (!accountId.trim()) { toast("Please enter the Exchange UID / UserID."); return; }
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
    toast("Saved the external ID.");
    load();
  };

  // 1-b) Save API Keys (encrypted at Edge Function side)
  const onSaveKeys = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    if (!apiKey || !apiSecret) { toast("Please enter API Key / Secret."); return; }
    if (exch === "okx" && !passphrase) { toast("OKX requires a Passphrase."); return; }

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
      const anyErr = error as any;
      const resp = anyErr?.context?.response;
      if (resp && typeof resp.text === "function") {
        try { details = await resp.text(); } catch {}
      }
      console.error("[save-keys] error:", error, details);
      toast(`Save Keys failed: ${error.message}${details ? `\n\n${details}` : ""}`);
      return;
    }

    console.log("[save-keys] result:", data);
    toast("Saved API Keys (server-side encryption).");
    setApiKey(""); setApiSecret(""); setPassphrase("");
    load();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Virtual Custody / Exchanges</h1>
        <Link to="/dashboard" className="text-sm underline">Back to Dashboard</Link>
      </div>

      {/* ====== Guide (English) ====== */}
      <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
        <div className="font-semibold">Step 1: Create read-only API keys on each exchange</div>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">How to get API keys for Binance</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            <li>Log in to Binance → Profile → <b>API Management</b>.</li>
            <li>Click <b>Create API</b> (e.g., “System generated”) and give it a label.</li>
            <li>Enable <b>Read-only</b> permission (do <u>not</u> enable trading/withdrawal).</li>
            <li>If you enable IP restriction, add the server IP(s) later.</li>
            <li>Copy the <b>API Key</b> and <b>Secret Key</b> (Secret is only shown once).</li>
            <li>Optionally copy your profile <b>UID</b> as “External ID”.</li>
          </ol>
        </details>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">How to get API keys for Bybit</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            <li>Log in to Bybit → User menu → <b>API</b>.</li>
            <li><b>Create New Key</b> → Key Type: <b>System-generated</b>, Permission: <b>Read-only</b>.</li>
            <li>Enable reading for spot/derivatives (do not enable Trading/Withdrawal).</li>
            <li>Copy <b>API Key</b>, <b>Secret</b>, and your <b>UID</b>.</li>
          </ol>
        </details>

        <details className="border rounded p-3 bg-white/30">
          <summary className="cursor-pointer font-medium">How to get API keys for OKX</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            <li>Log in to OKX → Profile → <b>API</b> → <b>Create V5 API Key</b>.</li>
            <li>Use <b>Read</b> permissions (Account / Trading data, etc.).</li>
            <li>Create and keep your <b>Passphrase</b> carefully.</li>
            <li>Copy <b>API Key</b>, <b>Secret</b>, <b>Passphrase</b>, and your <b>UID</b>.</li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            * For OKX, <b>Passphrase</b> is required in the input below.
          </p>
        </details>

        <p className="text-xs text-muted-foreground">
          Security: API Key/Secret are saved via an Edge Function using <code>EDGE_KMS_KEY</code> for encryption.
          Do not grant trading/withdrawal permissions (read-only only).
        </p>
      </div>

      {/* ===== 1) Link ID & Save API Keys (unchanged behavior) ===== */}
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
            placeholder="Exchange UID / UserID (optional)"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
          <button
            className="px-3 py-1.5 rounded border"
            onClick={onSaveId}
            disabled={busy}
            title="Save external ID only"
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
          * For OKX, <b>passphrase</b> is required. After saving, connection status becomes <code>linked_keys</code>.
        </p>
      </div>

      {/* ===== NOTE: Requested “2) Sync” section has been removed per spec ===== */}

      {/* ===== Connections list (unchanged) ===== */}
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
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    title="Scroll to top"
                  >
                    Top
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
