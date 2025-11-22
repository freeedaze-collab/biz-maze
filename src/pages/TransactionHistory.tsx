// src/pages/TransactionHistory.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BalanceRow = { source: string; asset: string; amount: number };
type TxRow = {
  tx_id?: number | null;
  ctx_id?: string | null; // wallet:123, exchange:abc（将来拡張用）
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
  // v_all_transactions には tx_id/ctx_id が無いので、暫定キーとして source+source_id を使う
  if (t.source && t.source_id) return `ctx:${t.source}:${t.source_id}`;
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
        // ★ RLS に任せるので user_id で絞り込まない
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

  const loadUsageDrafts = async (rows: TxRow[]) => {
    if (!user?.id) return;
    const ids = rows
      .map((t) => (typeof t.tx_id === "number" ? t.tx_id : null))
      .filter((v): v is number => v !== null);
    const ctxIds = rows
      .map((t) => (t.ctx_id ? t.ctx_id : null))
      .filter((v): v is string => !!v);
    if (ids.length === 0 && ctxIds.length === 0) {
      setUsageDrafts({});
      return;
    }

    try {
      const [{ data: labelsByTx }, { data: labelsByCtx }, { data: predsByTx }, { data: predsByCtx }] = await Promise.all([
        ids.length
          ? supabase
              .from("transaction_usage_labels")
              .select("tx_id, predicted_key, confirmed_key, confidence")
              .in("tx_id", ids)
          : Promise.resolve({ data: [] }),
        ctxIds.length
          ? supabase
              .from("transaction_usage_labels")
              .select("ctx_id, predicted_key, confirmed_key, confidence")
              .in("ctx_id", ctxIds)
          : Promise.resolve({ data: [] }),
        ids.length
          ? supabase
              .from("transaction_usage_predictions")
              .select("tx_id, label, score")
              .in("tx_id", ids)
          : Promise.resolve({ data: [] }),
        ctxIds.length
          ? supabase
              .from("transaction_usage_predictions")
              .select("ctx_id, label, score")
              .in("ctx_id", ctxIds)
          : Promise.resolve({ data: [] }),
      ]);

      const next: Record<string, UsageDraft> = {};

      for (const p of predsByTx ?? []) {
        if (!p?.tx_id) continue;
        const key = `tx:${p.tx_id}`;
        next[key] = {
          ...next[key],
          predicted: (p as any).label ?? null,
          confidence: typeof (p as any).score === "number" ? Number((p as any).score) : null,
        };
      }

      for (const p of predsByCtx ?? []) {
        if (!(p as any)?.ctx_id) continue;
        const key = `ctx:${(p as any).ctx_id}`;
        next[key] = {
          ...next[key],
          predicted: (p as any).label ?? null,
          confidence: typeof (p as any).score === "number" ? Number((p as any).score) : null,
        };
      }

      for (const l of labelsByTx ?? []) {
        if (!l?.tx_id) continue;
        const key = `tx:${l.tx_id}`;
        next[key] = {
          ...next[key],
          predicted: (l as any).predicted_key ?? next[key]?.predicted ?? null,
          confirmed: (l as any).confirmed_key ?? null,
          confidence:
            typeof (l as any).confidence === "number"
              ? Number((l as any).confidence)
              : next[key]?.confidence ?? null,
        };
      }

      for (const l of labelsByCtx ?? []) {
        if (!(l as any)?.ctx_id) continue;
        const key = `ctx:${(l as any).ctx_id}`;
        next[key] = {
          ...next[key],
          predicted: (l as any).predicted_key ?? next[key]?.predicted ?? null,
          confirmed: (l as any).confirmed_key ?? null,
          confidence:
            typeof (l as any).confidence === "number"
              ? Number((l as any).confidence)
              : next[key]?.confidence ?? null,
        };
      }

      setUsageDrafts(next);
    } catch (e: any) {
      console.warn("[TransactionHistory] loadUsageDrafts warn", e?.message ?? e);
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
        exchange: "binance", // 既存維持
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

  // ===== Predict Usage / Save Usage は前回渡した実装そのまま =====
  // ...（onPredictUsage / onSaveUsage / normalizeSuggestedKey は省略せず、この前お渡ししたものをそのまま使ってください）

  // 以降の Balances / table のレンダリング部分も前回のままで OK です
  // （差分は loadTxs 内の .eq("user_id", user.id) を外したところだけ）
  // もしファイル丸ごと差し替える場合は、前のバージョンをベースに
  // loadTxs の中身だけこの実装に置き換えても動きます。
}
