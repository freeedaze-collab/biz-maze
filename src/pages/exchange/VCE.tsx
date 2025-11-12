import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Conn = { id: number; provider: string; label: string | null; created_at: string };

export default function VCE() {
  const { user } = useAuth();
  const [list, setList] = useState<Conn[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("exchange_connections")
      .select("id, provider, label, created_at")
      .order("created_at", { ascending: false });
    if (!error) setList(data || []);
  };

  useEffect(() => { load(); }, [user?.id]);

  const linkBinance = async () => {
    try {
      if (!apiKey || !apiSecret) { alert("API Key / Secret を入力してください"); return; }
      setLoading(true);
      const r = await fetch("/functions/v1/exchange-binance-proxy?action=link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ provider: "binance", api_key: apiKey, api_secret: apiSecret, label }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "link failed");
      setApiKey(""); setApiSecret(""); setLabel("");
      await load();
      alert("Binance をリンクしました（読み取り権限のみで作成してください）");
    } catch (e: any) {
      alert(`Link error: ${e.message || e}`);
    } finally { setLoading(false); }
  };

  const testConn = async (id: number) => {
    try {
      setTesting(id);
      const r = await fetch(`/functions/v1/exchange-binance-proxy?action=test&conn_id=${id}`, {
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "test failed");
      alert("接続OK。現物アカウント情報を取得できました。");
    } catch (e: any) {
      alert(`Test error: ${e.message || e}`);
    } finally { setTesting(null); }
  };

  const syncLite = async (id: number) => {
    try {
      setTesting(id);
      const r = await fetch(`/functions/v1/exchange-binance-proxy?action=sync-lite&conn_id=${id}`, {
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "sync failed");
      alert(`残高同期: ${j.balances}件`);
    } catch (e: any) {
      alert(`Sync error: ${e.message || e}`);
    } finally { setTesting(null); }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Virtual Custody / Exchanges</h1>
      <p className="text-sm text-muted-foreground">
        取引所の読み取りAPIキーを安全に保存し、アカウント/残高の同期を行います（まず Binance）。
      </p>

      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">Link Binance</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="API Key" value={apiKey} onChange={e=>setApiKey(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="API Secret" value={apiSecret} onChange={e=>setApiSecret(e.target.value)} />
          <input className="md:col-span-2 border rounded px-3 py-2" placeholder="Label (optional)" value={label} onChange={e=>setLabel(e.target.value)} />
        </div>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={loading}
          onClick={linkBinance}
        >
          {loading ? "Linking..." : "Link (Binance)"}
        </button>
      </div>

      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">My Exchange Connections</div>
        {list.length === 0 ? (
          <div className="text-sm text-muted-foreground">No connections yet.</div>
        ) : (
          <ul className="space-y-2">
            {list.map(c => (
              <li key={c.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-mono">{c.provider} #{c.id}</div>
                  <div className="text-xs text-muted-foreground">{c.label ?? "—"} • {new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 border rounded" onClick={()=>testConn(c.id)} disabled={testing===c.id}>
                    {testing===c.id ? "Testing..." : "Test"}
                  </button>
                  <button className="px-3 py-1 border rounded" onClick={()=>syncLite(c.id)} disabled={testing===c.id}>
                    {testing===c.id ? "Syncing..." : "Sync (balances)"}
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
