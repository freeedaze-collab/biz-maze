// supabase/functions/build-statements/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// 共有モジュールを使わず、関数ファイル内に直書き
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

function jsonHeaders(extra: Record<string, string> = {}) {
  return { ...corsHeaders, "Content-Type": "application/json", ...extra };
}

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    // 配線確認用のダミー応答
    const resp = {
      pl: { lines: [{ account_code: "sales", amount: 0 }], net_income: 0 },
      bs: { lines: [{ account_code: "cash", amount: 0 }] },
      cf: { method: "indirect" as const, operating: 0, adjustments: 0 },
    };
    return new Response(JSON.stringify(resp), { headers: jsonHeaders() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
});
