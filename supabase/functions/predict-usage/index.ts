// supabase/functions/predict-usage/index.ts
// 目的: v_all_transactions から簡易ヒューリスティックで用途候補を返す（DBには書かない）
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  since?: string | null;
  until?: string | null;
};

type TxRow = {
  tx_id: number;
  user_id: string;
  source: string | null;
  asset: string | null;
  exchange: string | null;
  symbol: string | null;
  fiat_value_usd: number | null;
};

type Suggestion = {
  tx_id: number;
  suggestion: string;
  confidence: number;
};

const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});

// 超簡易な用途予測ロジック（必要に応じてチューニング）
function suggestUsage(tx: TxRow): Suggestion | null {
  const valRaw = tx.fiat_value_usd;
  if (valRaw === null || valRaw === undefined) return null;
  const val = Number(valRaw);
  if (!isFinite(val) || val === 0) return null;

  const sign = val >= 0 ? 1 : -1;
  const src = (tx.source ?? "").toLowerCase();
  const asset = (tx.asset ?? "").toLowerCase();
  const symbol = (tx.symbol ?? "").toLowerCase();

  if (src === "exchange") {
    if (sign < 0) {
      return { tx_id: tx.tx_id, suggestion: "inventory_trader", confidence: 0.8 };
    } else {
      return { tx_id: tx.tx_id, suggestion: "disposal_sale", confidence: 0.8 };
    }
  }

  if (src === "wallet") {
    if (sign < 0) {
      if (symbol.includes("gas") || symbol.includes("fee")) {
        return { tx_id: tx.tx_id, suggestion: "expense", confidence: 0.9 };
      }
      return { tx_id: tx.tx_id, suggestion: "payment", confidence: 0.7 };
    } else {
      if (asset.includes("btc") || asset.includes("eth") || symbol.includes("usdt")) {
        return { tx_id: tx.tx_id, suggestion: "investment", confidence: 0.7 };
      }
      return { tx_id: tx.tx_id, suggestion: "revenue", confidence: 0.6 };
    }
  }

  return {
    tx_id: tx.tx_id,
    suggestion: sign > 0 ? "investment" : "expense",
    confidence: 0.5,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: cors(origin),
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500,
        headers: cors(origin),
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Auth
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no_token" }), {
        status: 401,
        headers: cors(origin),
      });
    }
    const token = authz.slice("Bearer ".length);
    const { data: u, error: uerr } = await supabase.auth.getUser(token);
    if (uerr) {
      return new Response(JSON.stringify({ error: "auth_error", details: uerr.message }), {
        status: 401,
        headers: cors(origin),
      });
    }
    const userId = u?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "bad_token" }), {
        status: 401,
        headers: cors(origin),
      });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const since = body?.since ?? null;
    const until = body?.until ?? null;

    let q = supabase
      .from("v_all_transactions")
      .select("tx_id, user_id, source, asset, exchange, symbol, fiat_value_usd")
      .eq("user_id", userId)
      .order("ts", { ascending: true })
      .limit(2000);

    if (since) q = q.gte("ts", since);
    if (until) q = q.lte("ts", until);

    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: "select_failed", details: error.message }), {
        status: 500,
        headers: cors(origin),
      });
    }

    const rows = (data as TxRow[]) ?? [];
    const suggestions: Suggestion[] = [];

    for (const tx of rows) {
      const s = suggestUsage(tx);
      if (!s) continue;
      suggestions.push(s);
    }

    // DB には書かず、候補のみ返却
    return new Response(
      JSON.stringify({
        ok: true,
        suggestions: suggestions.map((s) => ({
          tx_id: s.tx_id,
          suggestion: s.suggestion,
          confidence: s.confidence,
        })),
      }),
      { status: 200, headers: cors(origin) }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "panic", details: String(e?.message ?? e) }), {
      status: 500,
      headers: cors(origin),
    });
  }
});
