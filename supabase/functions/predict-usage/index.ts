// supabase/functions/predict-usage/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  try {
    const origin = req.headers.get("origin") ?? "*";
    const headers = {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
      "access-control-allow-methods": "POST,OPTIONS",
      "content-type": "application/json"
    };
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });

    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "no_token" }), { status: 401, headers });
    const token = authz.slice("Bearer ".length);

    const { data: { user }, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !user) return new Response(JSON.stringify({ error: "bad_token", details: uerr?.message }), { status: 401, headers });

    const { data: txs, error: terr } = await supabase
      .from("v_all_transactions")
      .select("source, source_id, amount, asset, exchange, chain, fee")
      .eq("user_id", user.id)
      .limit(2000);

    if (terr) throw terr;

    const suggestions = [];
    for (const t of txs ?? []) {
      const code = predictUsage(t);
      suggestions.push({ ctx_id: t.source_id, suggestion: code, confidence: 1.0 });
    }

    // 予測結果保存
    const upserts = (txs ?? []).map((t) => ({
      user_id: user.id,
      ctx_id: t.source_id,
      source: t.source,
      predicted_key: predictUsage(t),
      confidence: 1.0,
      updated_at: new Date().toISOString()
    }));
    await supabase.from("transaction_usage_labels").upsert(upserts, { onConflict: "user_id,ctx_id" });

    return new Response(JSON.stringify({ ok: true, suggestions }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});

function predictUsage(t: any): string {
  const a = (t.asset ?? "").toUpperCase();
  const e = (t.exchange ?? "").toLowerCase();
  if (e && e.includes("bybit")) return "inventory_trader";
  if (e && e.includes("okx")) return "inventory_trader";
  if (e && e.includes("binance")) return "inventory_broker";
  if (a === "BTC" || a === "ETH") return "investment";
  if (a === "USDC" || a === "JPYC") return "payment";
  return "investment";
}
