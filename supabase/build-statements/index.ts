// supabase/functions/build-statements/index.ts
// 目的: ユーザーの wallet_transactions と transaction_usage_labels を集計し、PL/BS/CF を返す
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
  // JWT検証はOFFでも、RLSで絞りたいので受信したJWTを使う
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
type Tx = {
  id: number;
  user_id: string;
  direction: "in" | "out" | null;
  fiat_value_usd: number | null;
  occurred_at: string | null;
};
type Label = {
  user_id: string;
  tx_id: number;
  label: string;
};

// ---------------- ビルド本体 ----------------
async function buildStatements(req: Request) {
  const supabase = getSupabaseClient(req);

  // 期間指定などを将来入れたいときのために body を読む
  let body: any = {};
  try {
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch (_e) { /* no-op */ }

  // 期間フィルタ（任意）
  const dateFrom: string | undefined = body?.dateFrom; // ISO (e.g. "2025-01-01")
  const dateTo: string | undefined = body?.dateTo;

  // 取引を取得（RLSで呼び出しユーザーに限定）
  let txq = supabase.from("wallet_transactions")
    .select("id,user_id,direction,fiat_value_usd,occurred_at")
    .order("occurred_at", { ascending: true })
    .limit(2000);

  if (dateFrom) txq = txq.gte("occurred_at", dateFrom);
  if (dateTo)   txq = txq.lte("occurred_at", dateTo);

  const { data: txs, error: txErr } = await txq;
  if (txErr) throw new Error(`transactions: ${txErr.message}`);

  const userId = txs?.[0]?.user_id; // RLSで同一ユーザーのみ返る想定
  // ラベル取得（無くてもOK）
  let lblq = supabase.from("transaction_usage_labels")
    .select("user_id,tx_id,label");
  if (userId)  lblq = lblq.eq("user_id", userId);
  const { data: labels, error: lblErr } = await lblq;
  if (lblErr && lblErr.code !== "PGRST205") { // 未作成は許容
    throw new Error(`labels: ${lblErr.message}`);
  }

  const labelMap = new Map<number, string>();
  (labels ?? []).forEach((l: Label) => labelMap.set(l.tx_id, l.label));

  // ---------- 集計ルール ----------
  // PL:
  //  label='revenue' は収益(+)
  //  label='expense' は費用(+)
  //  未ラベルは方向で仮分類: in→収益候補, out→費用候補（将来チューニング）
  // BS（簡易版）:
  //  現金（USD換算）= in の合計 - out の合計
  // CF（超簡易）:
  //  operating = PLの純額と一致させる（投資/財務は将来のラベル拡張で分離）
  let revenue = 0;
  let expense = 0;
  let inSum = 0;
  let outSum = 0;

  for (const t of (txs ?? []) as Tx[]) {
    const val = Number(t.fiat_value_usd ?? 0);
    if (!isFinite(val)) continue;

    if (t.direction === "in") inSum += val;
    if (t.direction === "out") outSum += val;

    const lab = labelMap.get(t.id);

    if (lab === "revenue") {
      revenue += Math.max(0, val); // in由来を想定
    } else if (lab === "expense" || lab === "fee" || lab === "payment") {
      expense += Math.abs(val); // out由来を想定
    } else if (lab === "transfer" || lab === "internal") {
      // 自社内移転: PL影響なし
    } else if (lab === "investment") {
      // 将来：BS固定資産などに積む。現状はPL影響なし
    } else if (lab === "airdrop") {
      revenue += Math.max(0, val);
    } else if (!lab) {
      // 未ラベルは方向で仮割り付け
      if (t.direction === "in") revenue += Math.max(0, val);
      else if (t.direction === "out") expense += Math.abs(val);
    }
  }

  const netIncome = revenue - expense;
  const cash = inSum - outSum;

  // 返却形式
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
      operating: Number(netIncome.toFixed(2)), // 超簡易（将来は投資/財務へ振替）
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
