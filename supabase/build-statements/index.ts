// supabase/functions/build-statements/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, handleOptions, jsonHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // CORS preflight
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    // ★ ここに既存の集計ロジック（PL/BS/CF作成）を残してください
    // 例のダミー応答（配線確認用）
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
