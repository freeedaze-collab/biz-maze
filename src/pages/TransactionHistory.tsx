// src/pages/TransactionHistory.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BalanceRow = { source: string; asset: string; amount: number };

// 予測プレビュー用のゆるい型
type UsageSuggestion = {
  tx_id?: string | number;
  suggestion?: string;          // 推定カテゴリ名など
  confidence?: number;          // 0..1 or 0..100 を想定
  amount?: number;
  note?: string;
};

export default function TransactionHistory() {
  const { user } = useAuth();

  // 入出力系
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  // 同期・残高
  const [busy, setBusy] = useState(false);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Predict Usage
  const [predictBusy, setPredictBusy] = useState(false);
  const [predictErr, setPredictErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<UsageSuggestion[]>([]);

  const parseDateToISO = (s: string) => {
    if (!s.trim()) return null;
    const p = s.replaceAll("/", "-");
    const d = new Date(p);
    return isNaN(d.getTime()) ? null : d.toISOString();
    // ※ サーバ側が epoch(ms) を想定していても ISO→Date で解釈できる実装が多いため
  };

  const loadBalances = async () => {
    if (!user?.id) return;
    const out: BalanceRow[] = [];
    try {
      const eb = await supabase
        .from("exchange_balances")
        .select("exchange, asset, amount")
        .eq("user_id", user.id)
        .limit(1000);
      if (!eb.error && eb.data) {
        for (const r of eb.data as any[])
          out.push({ source: `ex:${r.exchange}`, asset: r.asset, amount: Number(r.amount ?? 0) });
      }
    } catch {}
    try {
      const wb = await supabase
        .from("wallet_balances")
        .select("chain, asset, amount")
        .eq("user_id", user.id)
        .limit(1000);
      if (!wb.error && wb.data) {
        for (const r of wb.data as any[])
          out.push({ source: `wa:${r.chain}`, asset: r.asset, amount: Number(r.amount ?? 0) });
      }
    } catch {}
    setBalances(out);
  };

  useEffect(() => {
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 取引所同期（既存の呼び方を維持：fetch直叩き）
  const onSync = async () => {
    if (!user?.id) return alert("Please login again.");
    setBusy(true);
    setErr(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return alert("No auth token. Please re-login.");

      const base =
        import.meta.env.VITE_SUPABASE_URL ||
        (supabase as any).rest?.url?.replace?.("/rest/v1", "") ||
        "";
      const url = `${base}/functions/v1/exchange-sync`;

      const body = {
        exchange: "binance",            // UIでは選択させず（従前仕様のまま）
        symbols: null,                  // “all 固定”＝サーバ側で自動推定
        since: parseDateToISO(since),
        until: parseDateToISO(until),
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!res.ok || json?.ok === false) {
        const msg = `Sync failed (${res.status})\nstep: ${json?.step ?? "unknown"}\nerror: ${json?.error ?? "unknown"}`;
        setErr(msg);
        alert(msg);
      } else {
        alert(`Synced. Inserted: ${json?.inserted ?? 0}`);
        loadBalances();
      }
    } catch (e: any) {
      const m = "Sync failed: " + (e?.message ?? String(e));
      setErr(m);
      alert(m);
    } finally {
      setBusy(false);
    }
  };

  // Predict Usage：Edge Function を invoke() で呼ぶ（DBは変更しない＝プレビュー専用）
  const onPredict = async () => {
    if (!user?.id) return alert("Please login again.");
    setPredictBusy(true);
    setPredictErr(null);
    setPreview([]);

    // 1) 想定関数名の順で試行。どれも無ければフォールバック
    const candidates = ["predict-usage", "predict_usage", "usage-predict"];
    const body = {
      since: parseDateToISO(since),
      until: parseDateToISO(until),
      // サーバ側が追加パラメータを許容するならここに { preview: true } 等を渡しても良いが、
      // 既存挙動に干渉しないよう何も足さない
    };

    try {
      let lastErr: any = null;
      for (const fn of candidates) {
        try {
          const { data, error } = await supabase.functions.invoke(fn, { body });
          if (error) throw error;

          // 想定される戻りのゆるい吸収
          const arr: UsageSuggestion[] =
            (Array.isArray((data as any)?.suggestions) && (data as any).suggestions) ||
            (Array.isArray((data as any)?.data) && (data as any).data) ||
            (Array.isArray(data) && (data as any)) ||
            [];

          setPreview(arr);
          if (arr.length === 0) {
            setPredictErr("No suggestions in the selected period.");
          }
          return; // 成功したので抜ける
        } catch (e) {
          lastErr = e;
          // 次の候補名で再試行
        }
      }
      // すべて失敗
      if (lastErr) {
        // 404/未デプロイなど → Coming soon 表記にフォールバック
        setPredictErr("Predict Usage is not available yet on this environment (coming soon).");
        alert("Predict Usage: coming soon (Edge Function not found).");
      }
    } finally {
      setPredictBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of balances) {
      const k = `${b.source}:${b.asset}`;
      m.set(k, (m.get(k) ?? 0) + b.amount);
    }
    return Array.from(m.entries()).map(([k, v]) => {
      const [source, asset] = k.split(":");
      return { source, asset, amount: v };
    });
  }, [balances]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-bold">Transaction History</h1>

      <p className="text-lg">
        If you haven’t linked any wallet yet,{" "}
        <Link to="/wallets" className="underline">
          go to the Wallets page
        </Link>{" "}
        and link it first.
      </p>
      <p className="text-base">
        <b>Predict Usage</b> runs a server-side heuristic/ML to suggest categories from your
        transaction patterns. This is a <i>preview only</i>; it won’t edit any data unless a separate
        “apply” action exists on the server.
      </p>

      {/* フィルタ＆操作列 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span>Since</span>
          <input
            className="border rounded px-2 py-1 min-w-[110px]"
            placeholder="yyyy/mm/dd"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span>Until</span>
          <input
            className="border rounded px-2 py-1 min-w-[110px]"
            placeholder="yyyy/mm/dd"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </div>

        <button
          className="px-3 py-2 rounded border disabled:opacity-50"
          disabled={busy}
          onClick={onSync}
        >
          {busy ? "Syncing..." : "Sync Now"}
        </button>

        <button
          className="px-3 py-2 rounded border disabled:opacity-50"
          disabled={predictBusy}
          onClick={onPredict}
        >
          {predictBusy ? "Predicting..." : "Predict Usage"}
        </button>
      </div>

      {/* 残高 */}
      <h2 className="text-2xl font-bold">Balances</h2>
      {grouped.length === 0 ? (
        <p className="text-muted-foreground">
          No exchange/wallet balances found yet. Try syncing first.
        </p>
      ) : (
        <div className="border rounded p-3">
          <ul className="space-y-1">
            {grouped.map((g, i) => (
              <li key={i} className="text-sm">
                {g.source} • {g.asset}: <b>{g.amount}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 予測プレビュー（読み取り専用） */}
      <h2 className="text-2xl font-bold">Predicted Categories (preview)</h2>
      {predictErr && <div className="text-sm text-red-600">{predictErr}</div>}
      {preview.length === 0 ? (
        <p className="text-muted-foreground">No preview to show.</p>
      ) : (
        <div className="border rounded p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-1 pr-2">Tx</th>
                <th className="py-1 pr-2">Suggestion</th>
                <th className="py-1 pr-2">Confidence</th>
                <th className="py-1">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 pr-2">{r.tx_id ?? "-"}</td>
                  <td className="py-1 pr-2">{r.suggestion ?? r.note ?? "-"}</td>
                  <td className="py-1 pr-2">
                    {typeof r.confidence === "number"
                      ? (r.confidence <= 1 ? (r.confidence * 100).toFixed(0) : r.confidence.toFixed(0)) + "%"
                      : "-"}
                  </td>
                  <td className="py-1">{typeof r.amount === "number" ? r.amount : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs text-muted-foreground mt-2">
            * This is a read-only preview. No changes are written to the database from this screen.
          </div>
        </div>
      )}

      {/* 取引一覧（UIのみ。既存どおり未実装表示） */}
      <h2 className="text-2xl font-bold">Latest Transactions</h2>
      <p className="text-muted-foreground">No transactions are rendered in this UI section yet.</p>

      {err && <div className="text-red-600 whitespace-pre-wrap text-sm">{err}</div>}
    </div>
  );
}
