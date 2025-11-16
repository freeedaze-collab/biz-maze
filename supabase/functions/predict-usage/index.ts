// supabase/functions/predict-usage/index.ts
// 機能：期間条件（since/until）でユーザーの取引（取引所＋ウォレット）を読み出し、
//       簡易ヒューリスティックで「推定カテゴリ」をプレビューとして返す。
// 重要：DBは一切書き換えません。戻り値は suggestions[] のみ。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  since?: string | number | null;
  until?: string | number | null;
};

const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});

// 文字列/数値 → epoch(ms) に寄せる
function toMs(v?: string | number | null) {
  if (!v) return undefined;
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors(origin) });
    }

    // 環境変数
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "missing_env" }), { status: 500, headers: cors(origin) });
    }

    // 認証（JWT からユーザーを特定）
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no_token" }), { status: 401, headers: cors(origin) });
    }
    const token = authz.slice("Bearer ".length);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // token 検証
    const { data: g, error: gErr } = await admin.auth.getUser(token);
    if (gErr) {
      return new Response(JSON.stringify({ error: "getUser_failed", details: gErr.message }), {
        status: 401, headers: cors(origin),
      });
    }
    const userId = g?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "bad_token" }), { status: 401, headers: cors(origin) });
    }

    // 入力
    let body: Body = {};
    try { body = await req.json(); } catch {}
    const sinceMs = toMs(body.since);
    const untilMs = toMs(body.until);

    // 期間フィルタを文字列に（RLS対象テーブルは自分の行だけ返る前提）
    const sinceISO = sinceMs ? new Date(sinceMs).toISOString() : undefined;
    const untilISO = untilMs ? new Date(untilMs).toISOString() : undefined;

    // 取引所側（例：exchange_trades）とウォレット側（例：wallet_transactions）を可能な限り読む
    // どちらか無ければ片方だけで動作します
    const suggestions: any[] = [];

    // ---- Exchange trades (例: exchange_trades) ----
    try {
      let q = admin.from("exchange_trades")
        .select("id, ts, symbol, side, qty, price, fee, fee_asset, exchange")
        .eq("user_id", userId)
        .order("ts", { ascending: false })
        .limit(500);
      if (sinceISO) q = q.gte("ts", sinceISO);
      if (untilISO) q = q.lte("ts", untilISO);

      const { data: ex, error: exErr } = await q;
      if (exErr) throw exErr;

      for (const t of ex ?? []) {
        const amt = (Number(t.qty ?? 0) * Number(t.price ?? 0)) || null;

        // ざっくりヒューリスティック
        let suggestion = "Trading";
        let confidence = 0.7;
        if (t.fee && t.fee !== 0) {
          suggestion = "Trading (with Fee)";
          confidence = 0.75;
        }
        if (typeof t.symbol === "string" && /USDT|USD|JPY/i.test(t.symbol)) {
          confidence += 0.05;
        }

        suggestions.push({
          tx_id: t.id ?? `${t.exchange}:${t.symbol}:${t.ts}`,
          suggestion,
          confidence,
          amount: amt,
          note: `ex:${t.exchange} ${t.side ?? ""} ${t.symbol ?? ""}`.trim(),
        });
      }
    } catch {
      // テーブルが無い/権限無しでも落とさずに続行
    }

    // ---- Wallet transactions (例: wallet_transactions) ----
    try {
      let q2 = admin.from("wallet_transactions")
        .select("id, ts, chain, asset, amount, fee")
        .eq("user_id", userId)
        .order("ts", { ascending: false })
        .limit(500);
      if (sinceISO) q2 = q2.gte("ts", sinceISO);
      if (untilISO) q2 = q2.lte("ts", untilISO);

      const { data: wt, error: wtErr } = await q2;
      if (wtErr) throw wtErr;

      for (const w of wt ?? []) {
        const a = Number(w.amount ?? 0);
        let suggestion = a >= 0 ? "Deposit / Incoming" : "Payment / Outgoing";
        let confidence = 0.65;

        if (w.fee && Number(w.fee) !== 0) {
          suggestion = suggestion + " (with Network Fee)";
          confidence += 0.05;
        }

        suggestions.push({
          tx_id: w.id ?? `wa:${w.chain}:${w.asset}:${w.ts}`,
          suggestion,
          confidence,
          amount: a,
          note: `wa:${w.chain} ${w.asset}`,
        });
      }
    } catch {
      // 片側が無くてもOK
    }

    return new Response(JSON.stringify({ suggestions }), { status: 200, headers: cors(origin) });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "panic", details: e?.message ?? String(e) }), {
      status: 500, headers: cors(null),
    });
  }
});
