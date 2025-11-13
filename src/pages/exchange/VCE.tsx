// src/pages/exchange/VCE.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Exchange = "binance" | "bybit" | "okx";
type ExchangeConn = { id: number; user_id: string; exchange: Exchange; external_user_id?: string|null; created_at?: string|null; status?: string|null; };

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
  const toast = (m: string) => alert(m);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("exchange_connections")
      .select("id,user_id,exchange,external_user_id,created_at,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); setRows([]); } else { setRows((data as any) ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const onSaveId = async () => {
    if (!user?.id) return toast("Please login again.");
    if (!accountId.trim()) return toast("ID / UID を入力してください。");
    setBusy(true);
    const { error } = await supabase.from("exchange_connections").upsert(
      { user_id: user.id, exchange: exch, external_user_id: accountId.trim(), status: "linked_id" } as any,
      { onConflict: "user_id,exchange" }
    );
    setBusy(false);
    if (error) return toast("Save ID failed: " + error.message);
    toast("ID を保存しました。"); load();
  };

  const onSaveKeys = async () => {
    if (!user?.id) return toast("Please login again.");
    if (!apiKey || !apiSecret) return toast("API Key / Secret を入力してください。");
    if (exch === "okx" && !passphrase) return toast("OKX は Passphrase が必須です。");
    setBusy(true);
    const { error, data } = await supabase.functions.invoke("exchange-save-keys", {
      body: { exchange: exch, external_user_id: accountId || null, apiKey, apiSecret, passphrase: exch === "okx" ? passphrase : undefined }
    });
    setBusy(false);
    if (error) {
      let details = ""; try { details = await (error as any)?.context?.response?.text?.() ?? ""; } catch {}
      console.error("[save-keys]", error, details);
      return toast(`Save Keys failed: ${error.message}${details ? `\n\n${details}` : ""}`);
    }
    console.log("[save-keys] result:", data);
    toast("API Keys を保存しました。（サーバ側で暗号化）");
    setApiKey(""); setApiSecret(""); setPassphrase(""); load();
  };

  // ★ ここを SDK ではなく fetch 直叩きに変更（本文を確実に拾う）
  const onSync = async () => {
    if (!user?.id) return toast("Please login again.");
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return toast("No auth token. Please re-login.");

      const base = import.meta.env.VITE_SUPABASE_URL || (supabase as any).rest?.url?.replace?.("/rest/v1","") || "";
      const url = `${base}/functions/v1/exchange-sync`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          exchange: syncExch,
          since: since || null,
          until: until || null,
          symbols: symbols || null, // 空でOK：サーバが自動推定
        }),
      });

      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { json = { raw: text }; }

      if (!res.ok || json?.ok === false) {
        console.error("[sync] non-2xx", res.status, json);
        return toast(`Sync failed (${res.status})\nstep: ${json?.step ?? "unknown"}\nerror: ${json?.error ?? "unknown"}${json?.symbols ? `\nsymbols: ${JSON.stringify(json.symbols)}` : ""}`);
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Virtual Custody / Exchanges</h1>
        <Link to="/dashboard" className="text-sm underline">Back to Dashboard</Link>
      </div>

      {/* …（ガイドとフォームは現状のままでOK。省略）… */}

      {/* Sync セクション */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">2) Sync</div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={syncExch} onChange={(e)=>setSyncExch(e.target.value as Exchange)} className="border rounded px-2 py-1">
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
            <option value="okx">OKX</option>
          </select>
          <input className="border rounded px-2 py-1 min-w-[210px]" placeholder="since (ISO or ms)" value={since} onChange={(e)=>setSince(e.target.value)} />
          <input className="border rounded px-2 py-1 min-w-[210px]" placeholder="until (ISO or ms)" value={until} onChange={(e)=>setUntil(e.target.value)} />
          <input className="border rounded px-2 py-1 min-w-[260px]" placeholder="symbols（空でOK。Binanceは自動推定）" value={symbols} onChange={(e)=>setSymbols(e.target.value)} />
          <button className="px-3 py-1.5 rounded border" onClick={onSync} disabled={busy}>Sync now</button>
        </div>
        <ul className="text-xs text-muted-foreground list-disc ml-5">
          <li>Binance で <b>symbols 空欄</b> → サーバ側で USDT 現物ペアを自動推定。</li>
        </ul>
      </div>

      {/* 接続一覧（現状のまま） */}
      {/* …省略… */}
    </div>
  );
}
