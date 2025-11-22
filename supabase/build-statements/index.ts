// supabase/functions/build-statements/index.ts
// 目的: ユーザーの v_all_transactions と transaction_usage_labels を集計し、PL/BS/CF を返す
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------- CORS（単体完結; 共有モジュール不使用） ----------------
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // 動作優先。あとで本番ドメインへ絞ってOK
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const handleOptions = (req: Request) =>
  req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
const jsonHeaders = (extra: Record<string, string> = {}) =>
  ({ ...corsHeaders, "Content-Type": "application/json", ...extra });

// ---------------- Supabase クライアント（RLS: ユーザーJWT優先） ----------------
function getSupabaseClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

  if (bearer) {
    return createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  }
  // 未ログインでも動くが、RLSでゼロ件になる想定
  return createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
}

// ---------------- 型の最小定義 ----------------
type TxRow = {
  user_id: string;
  source: "wallet" | "exchange" | string;
  source_id: string | null;
  fiat_value_usd: number | null;
  ts: string | null;
};

// ---------------- ビルド本体 ----------------
async function buildStatements(req: Request) {
  const supabase = getSupabaseClient(req);

  // 期間指定（任意; 将来の拡張に備えて body を読む）
  let body: any = {};
  try {
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch (_e) { /* no-op */ }

  const dateFrom: string | undefined = body?.dateFrom; // ISO (e.g. "2025-01-01")
  const dateTo: string | undefined = body?.dateTo;

  // ---------- 1) 取引（ウォレット＋取引所）の取得: v_all_transactions ベース ----------
  let txq = supabase
    .from("v_all_transactions")
    .select("user_id, source, source_id, fiat_value_usd, ts")
    .order("ts", { ascending: true })
    .limit(5000);

  if (dateFrom) txq = txq.gte("ts", dateFrom);
  if (dateTo)   txq = txq.lte("ts", dateTo);

  const { data: txs, error: txErr } = await txq;
  if (txErr) throw new Error(`transactions: ${txErr.message}`);

  const txList = (txs ?? []) as TxRow[];
  const userId = txList[0]?.user_id ?? null;

  // ---------- 2) 用途ラベルの取得（ある場合のみ利用） ----------
  // スキーマが tx_id / ctx_id / label / predicted_key / confirmed_key など
  // どれになっていても動くように * で取得し、動的に解釈する。
  let lblq = supabase.from("transaction_usage_labels").select("*");
  if (userId) lblq = lblq.eq("user_id", userId);

  const { data: labels, error: lblErr } = await lblq;
  if (lblErr && (lblErr as any).code !== "PGRST205") {
    // テーブル未作成(PGRST205)は許容、それ以外はエラー扱い
    throw new Error(`labels: ${lblErr.message}`);
  }

  // tx ごとのキー: "source:source_id" 形式を基本にする
  const labelMap = new Map<string, string>();
  (labels ?? []).forEach((l: any) => {
    // tx側とマッチさせるキー
    let key: string | null = null;

    if (l.ctx_id) {
      // 既に ctx_id（"wallet:123" など）を持っている場合
      key = String(l.ctx_id);
    } else if (l.source && l.source_id) {
      key = `${l.source}:${l.source_id}`;
    } else if (typeof l.tx_id === "number") {
      // 旧仕様: wallet_transactions.id ベースのラベルだった場合
      key = `wallet:${l.tx_id}`;
    }

    if (!key) return;

    const effLabel: string | null =
      l.confirmed_key ??
      l.predicted_key ??
      l.label ??
      null;

    if (!effLabel) return;
    labelMap.set(key, String(effLabel));
  });

  // ---------- 3) 集計ルール ----------
  // PL:
  //  label が revenue/income 系 → revenue
  //  label が expense/fee/payment/cost 系 → expense
  //  transfer/internal/investment 等は PL 影響なし（現時点では除外）
  //  未ラベル取引は PL には入れない（過大計上を避けるため）
  //
  // BS（超簡易版）:
  //  cash = revenue - expense （= netIncome と同じ。将来は投資/財務を分ける）
  //
  // CF:
  //  operating = netIncome, adjustments = 0 （将来詳細設計）

  const revenueLabels = new Set([
    "revenue", "income", "sale", "sales",
    "airdrop", "staking", "staking_reward",
    "mining", "mining_reward", "gain"
  ]);
  const expenseLabels = new Set([
    "expense", "fee", "payment", "cost", "loss", "interest_expense"
  ]);
  const ignoreLabels = new Set([
    "transfer", "internal", "investment", "inventory_trader", "inventory_broker"
  ]);

  let revenue = 0;
  let expense = 0;

  for (const t of txList) {
    const val = Number(t.fiat_value_usd ?? 0);
    if (!isFinite(val) || val <= 0) continue; // 0以下 or NaN は無視（評価が無い/異常値）

    const ctxKey = `${t.source}:${t.source_id ?? ""}`;
    const lab = labelMap.get(ctxKey) ?? null;
    const labLower = lab ? lab.toLowerCase() : null;

    if (labLower && ignoreLabels.has(labLower)) {
      // 自社間移転・投資など: 現時点では PL 影響なし
      continue;
    }

    if (labLower && revenueLabels.has(labLower)) {
      revenue += val;
    } else if (labLower && expenseLabels.has(labLower)) {
      expense += val;
    } else {
      // 未ラベル or 未知ラベル → 安全のため PL には載せない（将来 IFRS 用途コードで精密化）
      continue;
    }
  }

  const netIncome = revenue - expense;
  const cash = netIncome; // 現時点では「すべて営業キャッシュフロー」として扱う簡易版

  const resp = {
    pl: {
      lines: [
        { account_code: "revenue", amount: Number(revenue.toFixed(2)) },
        { account_code: "expense", amount: Number(expense.toFixed(2)) },
      ],
      net_income: Number(netIncome.toFixed(2)),
    },
    bs: {
      lines: [
        { account_code: "cash", amount: Number(cash.toFixed(2)) },
        // 将来: crypto_assets, accrued_payable など拡張
      ],
    },
    cf: {
      method: "indirect" as const,
      operating: Number(netIncome.toFixed(2)),
      adjustments: 0,
    },
  };

  return new Response(JSON.stringify(resp), { headers: jsonHeaders() });
}

// ---------------- Entrypoint ----------------
serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    return await buildStatements(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
});
