
// supabase/functions/exchange-sync-save/index.ts

// // import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// フロントエンドから受け取ったレコードをDB形式に変換する
function transformRecord(record: any, userId: string, exchange: string) {
  const recordId = record.id || record.txid;
  if (!recordId) return null;

  // Trade, Deposit, Withdrawalで微妙に異なるフィールド名を統一
  const side = record.side || record.type;
  const symbol = record.symbol || record.currency;
  const price = record.price ?? 0;
  const fee_cost = record.fee?.cost;
  const fee_currency = record.fee?.currency;

  // 必須項目チェック
  if (!symbol || !side || !record.amount || !record.timestamp) return null;

  return {
    user_id: userId,
    exchange: exchange,
    trade_id: String(recordId), // IDを文字列に統一
    symbol: symbol,
    side: side, // 'buy', 'sell', 'deposit', 'withdrawal' のいずれか
    price: price,
    amount: record.amount,
    fee: fee_cost,
    fee_asset: fee_currency,
    ts: new Date(record.timestamp).toISOString(), // ISO文字列に統一
    raw_data: record, // 元データをそのまま保存
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const { exchange, records } = await req.json();
    if (!exchange || !records) throw new Error("Exchange and records are required.");
    if (!Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ totalSaved: 0, message: "No records to save." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[SAVE] Received ${records.length} records for ${exchange}. Transforming and upserting...`);

    // 1. 変換
    const transformedRecords = records.map(r => transformRecord(r, user.id, exchange)).filter(r => r !== null);

    // 2. 重複除去
    const uniqueRecords = Array.from(new Map(transformedRecords.map(r => [`${r!.exchange}-${r!.trade_id}`, r])).values());

    if (uniqueRecords.length === 0) {
      console.log("[SAVE] No valid or new records to save after transformation and deduplication.");
      return new Response(JSON.stringify({ totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[SAVE] Upserting ${uniqueRecords.length} unique records into exchange_trades...`);

    // 3. DBへ一括書き込み
    const { data, error } = await supabaseAdmin
      .from('exchange_trades')
      .upsert(uniqueRecords, { onConflict: 'user_id,exchange,trade_id' })
      .select();

    if (error) {
      console.error("[SAVE CRASH] DATABASE UPSERT FAILED:", error);
      throw error;
    }

    const totalSavedCount = data?.length ?? 0;
    console.log(`[SAVE] VICTORY! Successfully upserted ${totalSavedCount} records.`);

    return new Response(JSON.stringify({ totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[SAVE CRASH]`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
