// supabase/functions/generate-journal-entries/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const handleOptions = (req: Request): Response | null => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
};

const jsonHeaders = (extra: Record<string, string> = {}) => ({
  ...corsHeaders,
  "Content-Type": "application/json",
  ...extra,
});

type Tx = {
  id: number; user_id: string; occurred_at: string|null;
  direction: "in"|"out"|null; asset_symbol: string|null;
  fiat_value_usd: number|null;
};
type Label = { tx_id: number; confirmed_key: string|null; predicted_key: string|null; };

function linesFor(label: string, tx: Tx) {
  const amt = Math.max(0, Number(tx.fiat_value_usd ?? 0));
  const date = tx.occurred_at ?? new Date().toISOString();

  // 勘定科目は暫定コード（後でマスタ化可）
  const A = (account_code: string, debit: number, credit: number) =>
    ({ account_code, debit, credit, meta: { asset: tx.asset_symbol } });

  switch (label) {
    case "mining":
    case "staking":
      // 借：無形資産／貸：その他の収益
      return {
        entry: { entry_date: date, usage_key: label, memo: "auto: reward" },
        lines: [
          A("INTANGIBLE_CRYPTO", amt, 0),
          A("OTHER_INCOME", 0, amt),
        ]
      };
    case "ifrs15_non_cash":
      // 借：無形資産 or 在庫（暫定：無形資産）／貸：売上高
      return {
        entry: { entry_date: date, usage_key: label, memo: "auto: non-cash revenue" },
        lines: [
          A("INTANGIBLE_CRYPTO", amt, 0),
          A("REVENUE", 0, amt),
        ]
      };
    case "inventory_trader":
      // 取得時：借：棚卸資産／貸：現金
      if (tx.direction === "out") {
        return { entry: { entry_date: date, usage_key: label, memo: "auto: inventory acquire" },
          lines: [ A("INVENTORY_CRYPTO", amt, 0), A("CASH", 0, amt) ] };
      }
      // 売却時（簡易）：借：現金／貸：棚卸資産 ※売上原価等の精緻化は後続
      if (tx.direction === "in") {
        return { entry: { entry_date: date, usage_key: label, memo: "auto: inventory sale" },
          lines: [ A("CASH", amt, 0), A("INVENTORY_CRYPTO", 0, amt) ] };
      }
      break;
    case "inventory_broker":
      // FVLCS：評価差額を損益に
      return { entry: { entry_date: date, usage_key: label, memo: "auto: broker FVLCS" },
        lines: [ A("INVENTORY_CRYPTO", amt, 0), A("FAIR_VALUE_GAIN", 0, amt) ] };
    case "disposal_sale":
      // 無形資産売却（簿価未管理の簡易版）：借：現金／貸：売却益
      return { entry: { entry_date: date, usage_key: label, memo: "auto: disposal" },
        lines: [ A("CASH", amt, 0), A("GAIN_ON_DISPOSAL", 0, amt) ] };
    case "investment":
    default:
      // 投資取得：借：無形資産／貸：現金
      if (tx.direction === "out") {
        return { entry: { entry_date: date, usage_key: "investment", memo: "auto: investment acquire" },
          lines: [ A("INTANGIBLE_CRYPTO", amt, 0), A("CASH", 0, amt) ] };
      }
      // 受領（投資回収等）：借：現金／貸：その他収益（簡易）
      if (tx.direction === "in") {
        return { entry: { entry_date: date, usage_key: "investment", memo: "auto: investment inflow" },
          lines: [ A("CASH", amt, 0), A("OTHER_INCOME", 0, amt) ] };
      }
  }
  // フォールバック（生成しない）
  return null;
}

serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401, headers: jsonHeaders() });
  }

  // body: { tx_ids?: number[] } 無ければ、直近100件を対象
  const body = await req.json().catch(() => ({}));
  const txFilter = Array.isArray(body?.tx_ids) && body.tx_ids.length > 0 ? body.tx_ids : null;

  const q = supabase.from("wallet_transactions")
    .select("id,user_id,occurred_at,direction,asset_symbol,fiat_value_usd")
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false })
    .limit(100);
  const { data: txs, error: txErr } = txFilter ? await q.in("id", txFilter) : await q;
  if (txErr) return new Response(txErr.message, { status: 500, headers: jsonHeaders() });

  // ラベル取得
  const { data: labels, error: labErr } = await supabase
    .from("transaction_usage_labels")
    .select("tx_id,confirmed_key,predicted_key")
    .eq("user_id", user.id);
  if (labErr) return new Response(labErr.message, { status: 500, headers: jsonHeaders() });
  const map = new Map<number, Label>(); (labels ?? []).forEach((l: any) => map.set(l.tx_id, l));

  let created = 0;
  for (const tx of (txs ?? [])) {
    const l = map.get(tx.id);
    const key = l?.confirmed_key ?? l?.predicted_key;
    if (!key) continue;

    const material = linesFor(key, tx as Tx);
    if (!material) continue;

    // 既存仕訳（同tx_id）を消して再生成（冪等）
    const { data: oldEntries } = await supabase
      .from("journal_entries").select("id").eq("user_id", user.id).eq("tx_id", tx.id);
    if (oldEntries?.length) {
      const ids = oldEntries.map((e: any) => e.id);
      await supabase.from("journal_lines").delete().in("entry_id", ids);
      await supabase.from("journal_entries").delete().in("id", ids);
    }

    // 新規登録
    const { data: inserted, error: insErr } = await supabase
      .from("journal_entries")
      .insert({
        user_id: user.id,
        tx_id: tx.id,
        entry_date: material.entry.entry_date,
        source: "auto",
        usage_key: material.entry.usage_key,
        memo: material.entry.memo
      })
      .select("id").single();
    if (insErr) return new Response(insErr.message, { status: 500, headers: jsonHeaders() });

    const lines = material.lines.map((ln: any) => ({
      entry_id: inserted.id,
      account_code: ln.account_code,
      debit: ln.debit, credit: ln.credit, meta: ln.meta
    }));
    const { error: jlErr } = await supabase.from("journal_lines").insert(lines);
    if (jlErr) return new Response(jlErr.message, { status: 500, headers: jsonHeaders() });

    created += 1;
  }

  return new Response(JSON.stringify({ entries_created: created }), {
    headers: jsonHeaders(),
  });
});
