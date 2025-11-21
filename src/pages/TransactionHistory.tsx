// src/pages/TransactionHistory.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BalanceRow = { source: string; asset: string; amount: number };
type TxRow = {
  tx_id?: number | null;
  ctx_id?: string | null; // wallet:123, exchange:abc
  user_id: string;
  source: "wallet" | "exchange";
  source_id: string | null;
  ts: string;           // timestamptz
  chain: string | null;
  tx_hash: string | null;
  asset: string | null;
  amount: number | null;
  exchange: string | null;
  symbol: string | null;
  fee: number | null;
  fee_asset: string | null;
};

const makeUsageKey = (t: TxRow) => {
  if (typeof t.tx_id === "number") return `tx:${t.tx_id}`;
  if (t.ctx_id) return `ctx:${t.ctx_id}`;
  return undefined;
};

type UsageCategory = { key: string; ifrs_standard: string | null; description: string | null };
type UsageDraft = { predicted?: string | null; confirmed?: string | null; confidence?: number | null };

export default function TransactionHistory() {
  const { user } = useAuth();
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);

  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [usageOptions, setUsageOptions] = useState<UsageCategory[]>([]);
  const [usageDrafts, setUsageDrafts] = useState<Record<string, UsageDraft>>({});
  const [predicting, setPredicting] = useState(false);
  const [savingUsage, setSavingUsage] = useState(false);

  const parseDate = (s: string) => {
    if (!s.trim()) return null;
    const p = s.replaceAll("/", "-");
    const d = new Date(p);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  // ===== 用途カテゴリの読み込み（IFRS ラベルを選択肢化） =====
  const loadUsageOptions = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("usage_categories")
        .select("key, ifrs_standard, description")
        .order("key", { ascending: true });
      if (error) throw error;
      setUsageOptions((data as UsageCategory[]) ?? []);
    } catch (e: any) {
      console.warn("[TransactionHistory] loadUsageOptions warn", e?.message ?? e);
    }
  };

  // ===== Balances 読み込み（既存のまま・壊さない） =====
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

  // ===== Transactions 読み込み（v_all_transactions） =====
  const loadTxs = async () => {
    if (!user?.id) return;
    setErr(null);
    setUsageDrafts({});
    try {
      let q = supabase
        .from("v_all_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("ts", { ascending: false })
        .limit(1000);

      const s = parseDate(since);
      const u = parseDate(until);

      if (s) q = q.gte("ts", s);
      if (u) q = q.lte("ts", u);

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data as TxRow[]) ?? [];
      setTxs(rows);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    loadBalances();
    loadUsageOptions();
    loadTxs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ===== 既存 Sync（Edge Function 呼び出しは現状維持） =====
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
        exchange: "binance", // 既存維持（UIで複数化するなら後日拡張）
        symbols: null,       // “all 固定”＝サーバ自動推定
        since: parseDate(since),
        until: parseDate(until),
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
        const msg = `Sync failed (${res.status})
step: ${json?.step ?? "unknown"}
error: ${json?.error ?? "unknown"}`;
        setErr(msg);
        alert(msg);
      } else {
        alert(`Synced. Inserted: ${json?.inserted ?? 0}`);
        await loadBalances();
        await loadTxs();
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      alert("Sync failed: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  // ===== Predict Usage (Edge Function: predict-usage) =====
  const normalizeSuggestedKey = (label?: string | null) => {
    if (!label) return null;
    const l = label.toLowerCase();
    if (l.includes("mining")) return "mining";
    if (l.includes("stake")) return "staking";
    if (l.includes("impair")) return "impairment";
    if (l.includes("inventory")) return "inventory_trader";
    if (l.includes("non cash") || l.includes("non-cash")) return "ifrs15_non_cash";
    if (l.includes("disposal")) return "disposal_sale";
    if (l.includes("broker")) return "inventory_broker";
    // 売買・入出金系は投資（inventory_trader）を初期値に
    if (l.includes("trade")) return "investment";
    if (l.includes("deposit") || l.includes("payment") || l.includes("fee")) return "inventory_trader";
    return "investment";
  };

  const onPredictUsage = async () => {
    if (!user?.id) return alert("Please login again.");
    setPredicting(true);
    setErr(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return alert("No auth token. Please re-login.");

      const base =
        import.meta.env.VITE_SUPABASE_URL ||
        (supabase as any).rest?.url?.replace?.("/rest/v1", "") ||
        "";
      const url = `${base}/functions/v1/predict-usage`;

      const body = { since: parseDate(since), until: parseDate(until) };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { json = { raw: text }; }

      if (!res.ok || json?.error) {
        const msg = `Predict failed (${res.status})\nstep: ${json?.error ?? "unknown"}\ndetail: ${json?.details ?? json?.raw ?? "n/a"}`;
        setErr(msg);
        return alert(msg);
      }

      const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : [];
      const next = { ...usageDrafts } as Record<string, UsageDraft>;
      for (const s of suggestions) {
        const ctxId = (s?.ctx_id ?? s?.context_id ?? s?.source_ref ?? null) as any;
        const txIdRaw = (s?.tx_id ?? s?.txId ?? s?.id) as any;
        const txIdNum = Number(txIdRaw);
        const key = Number.isFinite(txIdNum)
          ? `tx:${txIdNum}`
          : ctxId
          ? `ctx:${ctxId}`
          : undefined;
        if (!key) continue;
        const predictedKey = normalizeSuggestedKey(s?.suggestion ?? s?.label ?? null);
        next[key] = {
          ...next[key],
          predicted: predictedKey,
          confidence: typeof s?.confidence === "number" ? Number(s.confidence) : next[key]?.confidence ?? null,
        };
      }
      setUsageDrafts(next);
      alert(`Predicted usage for ${suggestions.length} transactions. Review and Save to keep.`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      alert("Predict failed: " + (e?.message ?? String(e)));
    } finally {
      setPredicting(false);
    }
  };

  // ===== Save usage (predicted + confirmed) =====
  const onSaveUsage = async () => {
    if (!user?.id) return alert("Please login again.");
    const entries = Object.entries(usageDrafts).filter(([, v]) => v.predicted || v.confirmed);
    if (entries.length === 0) return alert("Nothing to save yet.");
    setSavingUsage(true);
    setErr(null);
    try {
      const labelsPayload = entries.map(([txId, v]) => ({
        user_id: user.id,
        tx_id: txId.startsWith("tx:") ? Number(txId.replace("tx:", "")) : null,
        ctx_id: txId.startsWith("ctx:") ? txId.replace("ctx:", "") : null,
        predicted_key: v.predicted ?? null,
        confirmed_key: v.confirmed ?? null,
        confidence: v.confidence ?? null,
        updated_at: new Date().toISOString(),
      }));

      const labelsByTx = labelsPayload.filter((p) => typeof p.tx_id === "number");
      const labelsByCtx = labelsPayload.filter((p) => !p.tx_id && p.ctx_id);

      const predsPayload = entries
        .filter(([, v]) => v.predicted)
        .map(([txId, v]) => ({
          user_id: user.id,
          tx_id: txId.startsWith("tx:") ? Number(txId.replace("tx:", "")) : null,
          ctx_id: txId.startsWith("ctx:") ? txId.replace("ctx:", "") : null,
          model: "edge",
          label: v.predicted,
          score: v.confidence ?? 1,
          created_at: new Date().toISOString(),
        }));

      const predsByTx = predsPayload.filter((p) => typeof p.tx_id === "number");
      const predsByCtx = predsPayload.filter((p) => !p.tx_id && p.ctx_id);

      if (labelsByTx.length) {
        const { error } = await supabase
          .from("transaction_usage_labels")
          .upsert(labelsByTx, { onConflict: "user_id,tx_id" });
        if (error) throw error;
      }

      if (labelsByCtx.length) {
        const { error } = await supabase
          .from("transaction_usage_labels")
          .upsert(labelsByCtx, { onConflict: "user_id,ctx_id" });
        if (error) throw error;
      }

      if (predsByTx.length) {
        const { error } = await supabase
          .from("transaction_usage_predictions")
          .upsert(predsByTx, { onConflict: "user_id,tx_id,model" });
        if (error) throw error;
      }

      if (predsByCtx.length) {
        const { error } = await supabase
          .from("transaction_usage_predictions")
          .upsert(predsByCtx, { onConflict: "user_id,ctx_id,model" });
        if (error) throw error;
      }

      alert("Saved usage predictions/labels.");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      alert("Save failed: " + (e?.message ?? String(e)));
    } finally {
      setSavingUsage(false);
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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-bold">Transaction History</h1>

      <p className="text-lg">
        If you haven’t linked any wallet yet,{" "}
        <Link to="/wallets" className="underline">
          go to the Wallets page
        </Link>{" "}
        and link it first.
      </p>
      <p className="text-base">
        <b>Predict Usage</b> tries to infer categories from patterns (it never edits data automatically).
      </p>

      {/* Filters & Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span>Since</span>
          <input
            className="border rounded px-2 py-1 min-w-[120px]"
            placeholder="yyyy/mm/dd"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span>Until</span>
          <input
            className="border rounded px-2 py-1 min-w-[120px]"
            placeholder="yyyy/mm/dd"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </div>

        <button
          className="px-3 py-2 rounded border disabled:opacity-50"
          disabled={busy}
          onClick={onSync}
          title="Fetch from exchanges; server merges to your tables"
        >
          {busy ? "Syncing..." : "Sync Now"}
        </button>
        <button
          className="px-3 py-2 rounded border disabled:opacity-50"
          onClick={onPredictUsage}
          disabled={predicting}
          title="Analyze patterns and suggest categories; non-destructive"
        >
          {predicting ? "Predicting..." : "Predict Usage"}
        </button>
        <button
          className="px-3 py-2 rounded border"
          onClick={loadTxs}
          title="Reload from view"
        >
          Refresh List
        </button>
        <button
          className="px-3 py-2 rounded border bg-blue-600 text-white disabled:opacity-50"
          onClick={onSaveUsage}
          disabled={savingUsage}
          title="Store predicted + confirmed usage labels for the listed transactions"
        >
          {savingUsage ? "Saving..." : "Save Usage Labels"}
        </button>
      </div>

      {/* Balances (existing section) */}
      <h2 className="text-2xl font-bold">Balances</h2>
      {grouped.length === 0 ? (
        <p className="text-muted-foreground">No exchange/wallet balances found yet. Try syncing first.</p>
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

      {/* Transactions table (from v_all_transactions) */}
      <h2 className="text-2xl font-bold">All Transactions</h2>
      {txs.length === 0 ? (
        <p className="text-muted-foreground">No transactions found for the current filters.</p>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Source</th>
                <th className="text-left p-2">Chain</th>
                <th className="text-left p-2">Exchange</th>
                <th className="text-left p-2">Asset/Symbol</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-right p-2">Fee</th>
                <th className="text-left p-2">Tx/Trade ID</th>
                <th className="text-left p-2">Predicted usage</th>
                <th className="text-left p-2">Your selection</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t, i) => {
                const key = makeUsageKey(t);
                const draft = key ? usageDrafts[key] : undefined;
                return (
                  <tr key={`${t.source}-${t.source_id ?? key ?? i}-${i}`} className="border-t">
                  <td className="p-2">{new Date(t.ts).toLocaleString()}</td>
                  <td className="p-2 capitalize">{t.source}</td>
                  <td className="p-2">{t.chain ?? "-"}</td>
                  <td className="p-2">{t.exchange ?? "-"}</td>
                  <td className="p-2">{t.asset ?? t.symbol ?? "-"}</td>
                  <td className="p-2 text-right">
                    {typeof t.amount === "number" ? t.amount.toLocaleString() : "-"}
                  </td>
                  <td className="p-2 text-right">
                    {typeof t.fee === "number"
                      ? `${t.fee.toLocaleString()} ${t.fee_asset ?? ""}`.trim()
                      : "-"}
                  </td>
                  <td className="p-2 font-mono">
                    {t.source === "wallet" ? (t.tx_hash ?? t.source_id ?? "-") : (t.source_id ?? "-")}
                  </td>
                  <td className="p-2 max-w-[220px]">
                    {(() => {
                      if (!draft?.predicted) return <span className="text-muted-foreground">(none)</span>;
                      const opt = usageOptions.find((o) => o.key === draft.predicted);
                      return (
                        <div className="space-y-1">
                          <div className="font-semibold">{draft.predicted}</div>
                          {opt?.ifrs_standard && (
                            <div className="text-xs text-muted-foreground">{opt.ifrs_standard}: {opt.description}</div>
                          )}
                          {typeof draft.confidence === "number" && (
                            <div className="text-xs text-muted-foreground">confidence: {draft.confidence.toFixed(2)}</div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-2">
                    {key ? (
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={draft?.confirmed ?? draft?.predicted ?? ""}
                        onChange={(e) =>
                          setUsageDrafts((prev) => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              confirmed: e.target.value || null,
                              predicted: prev[key]?.predicted ?? null,
                            },
                          }))
                        }
                      >
                        <option value="">(select usage)</option>
                        {(usageOptions.length
                          ? usageOptions
                          : [
                              { key: "investment", ifrs_standard: "IAS38", description: "General holding" },
                              { key: "inventory_trader", ifrs_standard: "IAS2", description: "Trading stock" },
                              { key: "staking", ifrs_standard: "Conceptual", description: "Staking rewards" },
                              { key: "mining", ifrs_standard: "Conceptual", description: "Mining rewards" },
                            ]
                        ).map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.key} ({o.ifrs_standard})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">No stable ID yet</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {err && <div className="text-red-600 whitespace-pre-wrap text-sm">{err}</div>}
    </div>
  );
}
