import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, jsonHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
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
