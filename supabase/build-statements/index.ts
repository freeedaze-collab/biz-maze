// supabase/functions/build-statements/index.ts
// 目的: ユーザーの v_all_transactions ＋ usage_key を集計し、PL/BS/CF を返す
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------- CORS ----------------
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const handleOptions = (req: Request) =>
  req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
const jsonHeaders = (extra: Record<string, string> = {}) => ({
  ...corsHeaders,
  "Content-Type": "application/json",
  ...extra,
});

// ---------------- Supabase クライアント ----------------
function getSupabaseClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

  if (bearer) {
    return createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  }
  return createClient(url, anon);
}

// ---------------- 型 ----------------
type TxRow = {
  ts: string | null;
  fiat_value_usd: number | null;
  usage_key: string | null;
};

// usage_key → PL区分の簡易マッピング
type PlClass = "revenue" | "expense" | "ignore";

function classifyUsage(label: string | null, val: number): PlClass {
  const sign = val >= 0 ? 1 : -1;
  if (!label) {
    // ラベル未設定時は符号ベース
    return sign > 0 ? "revenue" : "expense";
  }
  const l = label.toLowerCase();

  // 収益寄り
  if (
    l.includes("revenue") ||
    l.includes("sale") ||
    l.includes("income") ||
    l.includes("airdrop") ||
    l.includes("staking") ||
    l.includes("mining")
  ) {
    return "revenue";
  }

  // 費用寄り
  if (
    l.includes("expense") ||
    l.includes("fee") ||
    l.includes("gas") ||
    l.includes("commission") ||
    l.includes("payment")
  ) {
    return "expense";
  }

  // 社内移転・投資など（PL からは外す）
  if (
    l.includes("transfer") ||
    l.includes("internal") ||
    l.includes("investment") ||
    l.includes("inventory")
  ) {
    return "ignore";
  }

  // その他は符号にフォールバック
  return sign > 0 ? "revenue" : "expense";
}

// ---------------- 本体 ----------------
async function buildStatements(req: Request) {
  const supabase = getSupabaseClient(req);

  // body（期間フィルタ）
  let body: any = {};
  try {
    if (
      req.method === "POST" &&
      req.headers.get("content-type")?.includes("application/json")
    ) {
      body = await req.json();
    }
  } catch {
    // no-op
  }

  const dateFrom: string | undefined = body?.dateFrom;
  const dateTo: string | undefined = body?.dateTo;

  // v_all_transactions から取得（RLS で user_id は制御される想定）
  let txq = supabase
    .from("v_all_transactions")
    .select("ts, fiat_value_usd, usage_key")
    .order("ts", { ascending: true })
    .limit(5000);

  if (dateFrom) txq = txq.gte("ts", dateFrom);
  if (dateTo)   txq = txq.lte("ts", dateTo);

  const { data: txs, error: txErr } = await txq;
  if (txErr) throw new Error(`v_all_transactions: ${txErr.message}`);

  let revenue = 0;
  let expense = 0;
  let cash = 0;

  for (const t of (txs ?? []) as TxRow[]) {
    const rawVal = t.fiat_value_usd;
    if (rawVal === null || rawVal === undefined) continue;

    const val = Number(rawVal);
    if (!isFinite(val) || val === 0) continue;

    cash += val; // キャッシュは用途に関係なく足し込む

    const cls = classifyUsage(t.usage_key, val);
    const abs = Math.abs(val);

    if (cls === "revenue") {
      revenue += abs;
    } else if (cls === "expense") {
      expense += abs;
    }
    // ignore は PL には載せない（BS の cash だけ反映）
  }

  const netIncome = revenue - expense;

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
