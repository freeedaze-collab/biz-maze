import { useEffect, useRef, useState } from "react";
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

const FN_LINK   = import.meta.env.VITE_FN_EXCHANGE_LINK   || "/functions/v1/exchange-link";       // 既存（external_user_id保存）
const FN_SAVE   = import.meta.env.VITE_FN_SAVE_KEYS       || "/functions/v1/exchange-save-keys";  // ★ 新規（鍵保存）
const FN_SYNC   = import.meta.env.VITE_FN_EXCHANGE_SYNC   || "/functions/v1/exchange-sync";       // ★ 新規（同期）

export default function VCE() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExchangeConn[]>([]);
  const [loading, setLoading] = useState(true);

  // 入力UI
  const [exchange, setExchange] = useState<Exchange>("binance");
  const [extUserId, setExtUserId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiPassphrase, setApiPassphrase] = useState(""); // OKX only
  const [symbols, setSymbols] = useState(""); // Binance trades 用
  const sinceRef = useRef<HTMLInputElement>(null);
  const untilRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("exchange_connections")
      .select("id,user_id,exchange,external_user_id,created_at,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) setRows([]); else setRows((data as ExchangeConn[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const saveIdOnly = async () => {
    // 既存の exchange-link を利用（external_user_idだけ保存したいケース）
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return alert("Session missing");
      const r = await fetch(FN_LINK, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "link", exchange, external_user_id: extUserId.trim() }),
      });
      const t = await r.text(); let body: any = null; try { body = JSON.parse(t); } catch { body = t; }
      if (!r.ok || !body?.ok) throw new Error(typeof body === "string" ? body : body?.error || t);
      alert("Saved external_user_id");
      await load();
    } catch (e:any) { alert(e?.message ?? String(e)); }
  };

  const saveKeys = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return alert("Session missing");
      if (!apiKey || !apiSecret) return alert("API key/secret required");
      if (exchange === "okx" && !apiPassphrase) return alert("OKX requires passphrase");

      const r = await fetch(FN_SAVE, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          exchange,
          external_user_id: extUserId.trim() || null,
          api_key: apiKey,
          api_secret: apiSecret,
          api_passphrase: exchange === "okx" ? apiPassphrase : undefined,
        }),
      });
      const t = await r.text(); let body: any = null; try { body = JSON.parse(t); } catch { body = t; }
      if (!r.ok || !body?.ok) throw new Error(typeof body === "string" ? body : body?.error || t);
      alert("Saved API keys");
      setApiKey(""); setApiSecret(""); if (exchange==="okx") setApiPassphrase("");
      await load();
    } catch (e:any) { alert(e?.message ?? String(e)); }
  };

  const doSync = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return alert("Session missing");

      const since = sinceRef.current?.value;
      const until = untilRef.current?.value;

      const r = await fetch(FN_SYNC, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          exchange,
          symbols: symbols || undefined,
          since: since || undefined,
          until: until || undefined,
          kinds: ["trades","deposits","withdrawals"],
        }),
      });
      const t = await r.text(); let body: any = null; try { body = JSON.parse(t); } catch { body = t; }
      if (!r.ok || !body?.ok) throw new Error(typeof body === "string" ? body : body?.error || t);
      alert(`Synced: ${body.inserted}/${body.total} (errors: ${body.errors})`);
    } catch (e:any) { alert(e?.message ?? String(e)); }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Virtual Custody / Exchanges</h1>
        <Link to="/dashboard" className="text-sm underline">Back to Dashboard</Link>
      </div>

      <p className="text-sm text-muted-foreground">
        API キーで中央集権取引所（Binance / Bybit / OKX）に接続し、約定・入出金を同期します。鍵はAES-GCMで暗号化保存され、Edge Functions内でのみ復号されます。
      </p>

      {/* 1) ID & APIキー 保存 */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">1) Link ID & Save API Keys</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex gap-2">
            <select className="border rounded px-3 py-2" value={exchange} onChange={(e)=>setExchange(e.target.value as Exchange)}>
              <option value="binance">Binance</option>
              <option value="bybit">Bybit</option>
              <option value="okx">OKX</option>
            </select>
            <input className="flex-1 border rounded px-3 py-2" placeholder="External User ID / UID (任意)" value={extUserId} onChange={(e)=>setExtUserId(e.target.value)} />
            <button className="px-3 py-2 rounded border" onClick={saveIdOnly}>Save ID</button>
          </div>

          <div className="flex gap-2">
            <input className="flex-1 border rounded px-3 py-2" placeholder="API Key" value={apiKey} onChange={(e)=>setApiKey(e.target.value)} />
            <input className="flex-1 border rounded px-3 py-2" placeholder="API Secret" value={apiSecret} onChange={(e)=>setApiSecret(e.target.value)} />
            {exchange === "okx" && (
              <input className="flex-1 border rounded px-3 py-2" placeholder="OKX Passphrase" value={apiPassphrase} onChange={(e)=>setApiPassphrase(e.target.value)} />
            )}
            <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={saveKeys}>Save Keys</button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">* OKX は passphrase が必要です。保存後、接続のステータスは <code>linked_keys</code> になります。</p>
      </div>

      {/* 2) 同期 */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">2) Sync</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex gap-2">
            <select className="border rounded px-3 py-2" value={exchange} onChange={(e)=>setExchange(e.target.value as Exchange)}>
              <option value="binance">Binance</option>
              <option value="bybit">Bybit</option>
              <option value="okx">OKX</option>
            </select>
            <input ref={sinceRef} className="flex-1 border rounded px-3 py-2" placeholder="since (ISO or ms)" />
            <input ref={untilRef} className="flex-1 border rounded px-3 py-2" placeholder="until (ISO or ms)" />
          </div>
          <div className="flex gap-2">
            <input className="flex-1 border rounded px-3 py-2" placeholder="Binance symbols (e.g. BTCUSDT,ETHUSDT)" value={symbols} onChange={(e)=>setSymbols(e.target.value)} />
            <button className="px-3 py-2 rounded border" onClick={doSync}>Sync now</button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          * Binance の約定は <b>symbol が必須</b>です。Bybit/OKX はシンボル未指定でも取得可能。<br/>
          * 入出金も同時に同期します。
        </p>
      </div>

      {/* 3) 接続一覧 */}
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
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.exchange}</div>
                    <div className="text-xs text-muted-foreground">
                      UID: {r.external_user_id ?? "—"} • {r.created_at ?? "—"} • {r.status ?? "linked"}
                    </div>
                  </div>
                  <button className="px-3 py-1.5 rounded border text-xs" onClick={() => setExchange(r.exchange)}>
                    Use for sync
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
