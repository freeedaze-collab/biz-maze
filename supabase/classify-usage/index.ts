// supabase/functions/classify-usage/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, jsonHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    // TODO: ここに用途推定ロジック（暫定のOKを返す）
    return new Response(JSON.stringify({ ok: true }), {
      headers: jsonHeaders(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
});
