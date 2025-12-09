// supabase/functions/exchange-sync-daily/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// さきほどの fetchBinanceTrades などを共通モジュール化して再利用

Deno.serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. exchange_api_credentials / exchange_connections を全件取得
  const { data: creds, error } = await supabase
    .from("exchange_api_credentials")
    .select("user_id, exchange, external_user_id, enc_blob");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
  const untilMs = Date.now();

  let totalInserted = 0;
  const errors: any[] = [];

  for (const c of creds ?? []) {
    try {
      // ここで decryptBlob / fetchBinanceTrades 等を使って
      // 1ユーザー分ずつ exchange_trades / exchange_transfers に保存
      // （手動版と同じロジックを共通化して呼ぶ）
    } catch (e: any) {
      errors.push({ user_id: c.user_id, exchange: c.exchange, error: String(e?.message ?? e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, totalInserted, errors }), { status: 200 });
});
