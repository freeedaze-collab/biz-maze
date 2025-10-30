// supabase/functions/classify-usage/index.ts
// deno.json で "serve" エントリ済みを想定
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
type Tx = {
  id: number; user_id: string; direction: "in"|"out"|null;
  tx_hash: string; occurred_at: string|null;
  asset_symbol: string|null; fiat_value_usd: number|null;
  from_address?: string|null; to_address?: string|null; chain_id?: number|null;
};

function rules(tx: Tx): { key: string; score: number } {
  // 初期の素朴なルール（必要に応じて拡張）
  if (tx.direction === "in") {
    // 典型：報酬系
    if ((tx.from_address ?? "").toLowerCase().includes("coinbase") ||
        (tx.from_address ?? "").toLowerCase().includes("validator")) {
      return { key: "mining", score: 0.8 };
    }
    // 入金だが請求連携なし→非現金対価 or 投資受贈の暫定
    return { key: "ifrs15_non_cash", score: 0.6 };
  } else if (tx.direction === "out") {
    // 出金：投資取得 or 在庫取得
    // 暫定で投資扱い
    return { key: "investment", score: 0.6 };
  }
  return { key: "investment", score: 0.3 };
}

serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // 対象TXを取得（未ラベル or 予測未実施）
  const { data: txs, error: txErr } = await supabase
    .from("wallet_transactions")
    .select("id,user_id,direction,tx_hash,occurred_at,asset_symbol,fiat_value_usd,chain_id")
    .eq("user_id", user.id)
    .limit(500);
  if (txErr) return new Response(txErr.message, { status: 500 });

  const { data: labels } = await supabase
    .from("transaction_usage_labels")
    .select("tx_id")
    .eq("user_id", user.id);
  const labeled = new Set((labels ?? []).map((l: any) => l.tx_id));

  const targets = (txs ?? []).filter((t: any) => !labeled.has(t.id));

  const upserts = targets.map((t: Tx) => {
    const g = rules(t);
    return {
      tx_id: t.id,
      user_id: user.id,
      predicted_key: g.key,
      confidence: g.score,
    };
  });

  if (upserts.length > 0) {
    const { error: upErr } = await supabase
      .from("transaction_usage_labels")
      .upsert(upserts, { onConflict: "user_id,tx_id" });
    if (upErr) return new Response(upErr.message, { status: 500 });
  }

  return new Response(JSON.stringify({ processed: upserts.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
