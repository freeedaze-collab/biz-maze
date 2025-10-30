import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, jsonHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const body = await req.json().catch(() => ({}));
    const txIds: number[] = body?.tx_ids ?? [];

    // ★ 既存の仕訳生成ロジックをここに
    return new Response(JSON.stringify({ ok: true, tx_ids: txIds }), {
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
