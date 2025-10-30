// supabase/functions/build-statements/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Line = { account_code: string; debit: number; credit: number; };

function sum(arr: number[]) { return arr.reduce((a,b) => a+b, 0); }
function groupBy<T>(arr: T[], key: (t:T)=>string) {
  const m = new Map<string,T[]>(); for (const x of arr) {
    const k = key(x); const a = m.get(k) ?? []; a.push(x); m.set(k, a);
  } return m;
}

// P/L区分（暫定マッピング。必要に応じて見直し）
const PL_INCOME = new Set(["REVENUE","OTHER_INCOME","FAIR_VALUE_GAIN","GAIN_ON_DISPOSAL"]);
const PL_EXPENSE = new Set(["COGS","IMPAIRMENT_LOSS","INVENTORY_WRITE_DOWN","FAIR_VALUE_LOSS"]);

const BS_ASSETS  = new Set(["CASH","INTANGIBLE_CRYPTO","INVENTORY_CRYPTO"]);
const BS_LIABS   = new Set([]); // 現時点なし（必要に応じ追加）
const BS_EQUITY  = new Set([]); // 現時点なし（必要に応じ追加）

serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "this_month"; // 例: 2025-01 ~ 末等は後日拡張
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // 期間フィルタ（暫定：直近30日）
  const since = new Date(); since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  // 明細取得
  const { data: rows, error } = await supabase
    .from("journal_lines")
    .select("account_code,debit,credit,entry_id,entry:journal_entries(entry_date,user_id)")
    .gte("entry.entry_date", sinceIso);
  if (error) return new Response(error.message, { status: 500 });

  const lines: Line[] = (rows ?? []).map((r: any) => ({
    account_code: r.account_code,
    debit: Number(r.debit||0),
    credit: Number(r.credit||0),
  }));

  // P/L
  const gb = groupBy(lines, l => l.account_code);
  const pl: any[] = [];
  for (const [code, arr] of gb) {
    const bal = sum(arr.map(x => (PL_INCOME.has(code) ? (x.credit - x.debit)
                             : PL_EXPENSE.has(code) ? (x.debit - x.credit)
                             : 0)));
    if (PL_INCOME.has(code) || PL_EXPENSE.has(code)) {
      pl.push({ account_code: code, amount: bal });
    }
  }
  const plTotal = sum(pl.map(r => r.amount));

  // B/S（期末残：資産は借方-貸方、負債・資本は貸方-借方）
  const bs: any[] = [];
  for (const [code, arr] of gb) {
    if (BS_ASSETS.has(code)) {
      bs.push({ account_code: code, amount: sum(arr.map(x => x.debit - x.credit)) });
    } else if (BS_LIABS.has(code) || BS_EQUITY.has(code)) {
      bs.push({ account_code: code, amount: sum(arr.map(x => x.credit - x.debit)) });
    }
  }

  // CF（間接法・簡易）：当期純利益＝P/L合計、非資金項目（減損・評価損益など）を調整
  const netIncome = plTotal;
  // 非資金項目の近似（科目で指定）
  const nonCashAdjust = sum(lines.map(l => {
    if (["IMPAIRMENT_LOSS","INVENTORY_WRITE_DOWN","FAIR_VALUE_GAIN","FAIR_VALUE_LOSS","GAIN_ON_DISPOSAL"].includes(l.account_code)) {
      // 減損・棚卸評価・公正価値差額・売却益等をざっくり調整
      // 貸方>借方なら益 → マイナス調整、借方>貸方なら損 → プラス調整
      return (l.debit - l.credit);
    }
    return 0;
  }));
  const cfOperating = netIncome + nonCashAdjust;

  const result = {
    period,
    pl: { lines: pl, net_income: netIncome },
    bs: { lines: bs },
    cf: { method: "indirect", operating: cfOperating, adjustments: nonCashAdjust }
  };
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
