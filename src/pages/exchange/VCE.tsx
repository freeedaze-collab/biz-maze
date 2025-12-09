// src/pages/exchange/VCE.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { KeyRound, RefreshCcw, Info } from "lucide-react";

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
  }, [user?.id]);

  const toast = (msg: string) => alert(msg);

  const onSaveId = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    if (!accountId.trim()) { toast("Please enter your exchange UID/UserID."); return; }
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
    toast("Saved external ID.");
    load();
  };

  const onSaveKeys = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    if (!apiKey || !apiSecret) { toast("API Key / Secret are required."); return; }
    if (exch === "okx" && !passphrase) { toast("OKX requires a passphrase."); return; }

    setBusy(true);

    const { data: sess } = await supabase.auth.getSession();
    const headers =
      sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {};

    const { error } = await supabase.functions.invoke("exchange-save-keys", {
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
    toast("API keys stored securely.");
    setApiKey(""); setApiSecret(""); setPassphrase("");
    load();
  };

  const onSync = async () => {
    if (!user?.id) { toast("Please login again."); return; }

    setBusy(true);

    const { data: sess } = await supabase.auth.getSession();
    const headers =
      sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {};

    const { error, data } = await supabase.functions.invoke("exchange-sync", {
      headers,
      body: {
        exchange: syncExch,
        since: since || null,
        until: until || null,
        symbols: symbols.trim() ? symbols : null,
      },
    });
    setBusy(false);
    if (error) { console.error(error); toast("Sync failed: " + (error.message || "")); return; }
    console.log("[sync] result:", data);
    toast("Sync kicked off. It may take a few seconds to finish.");
  };

  return (
    <AppLayout
      title="Virtual Custody / Exchanges"
      subtitle="English-only, monochrome icons, and clearer calls to action without touching backend logic."
    >
      <div className="space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-4 bg-white shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <KeyRound className="h-5 w-5 text-slate-600" /> 1) Link ID &amp; Save API Keys
            </div>
            <p className="text-sm text-slate-600">Store your exchange UID and read-only API keys.</p>

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
                className="px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50"
                onClick={onSaveKeys}
                disabled={busy}
              >
                Save Keys
              </button>
            </div>
            <p className="text-xs text-slate-500">OKX always needs a passphrase. Keys are encrypted server-side.</p>
          </div>

          <div className="rounded-xl border p-4 bg-white shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <RefreshCcw className="h-5 w-5 text-slate-600" /> 2) Sync
            </div>
            <p className="text-sm text-slate-600">Kick off a sync for trades, deposits, and withdrawals.</p>
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
                  ? "Binance symbols (blank = ALL, e.g. BTCUSDT,ETHUSDT)"
                  : "Symbols (optional)"}
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
            <ul className="text-xs text-slate-500 list-disc ml-5">
              <li>Binance treats blank symbols as ALL (auto-detected).</li>
              <li>Deposits and withdrawals are fetched alongside trades.</li>
            </ul>
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-white shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Info className="h-5 w-5 text-slate-600" /> How to prepare keys
          </div>
          <div className="grid md:grid-cols-3 gap-3 text-sm text-slate-600">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-semibold">Binance</div>
              <ul className="list-disc ml-5 space-y-1">
                <li>Create an API key with Read-only permission.</li>
                <li>Copy API Key and Secret once displayed.</li>
                <li>UID is optional but recommended.</li>
              </ul>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-semibold">Bybit</div>
              <ul className="list-disc ml-5 space-y-1">
                <li>Use System-generated keys with Read-only access.</li>
                <li>Include spot/derivatives read access.</li>
                <li>Record UID if available.</li>
              </ul>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-semibold">OKX</div>
              <ul className="list-disc ml-5 space-y-1">
                <li>Create a V5 API key with Read permissions.</li>
                <li>Passphrase is mandatory—store it safely.</li>
                <li>Copy API Key, Secret, Passphrase, and UID.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-white shadow-sm">
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
                        ext_user: {r.external_user_id ?? "—"} • {r.created_at ?? "—"} • {r.status ?? "active"}
                      </div>
                    </div>
                    <button
                      className="px-3 py-1.5 rounded border text-xs"
                      onClick={() => { setSyncExch(r.exchange); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      title="Jump to the sync form with this exchange preselected"
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
    </AppLayout>
  );
}
