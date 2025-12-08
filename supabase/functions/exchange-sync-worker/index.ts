// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40' // 安定バージョンに固定
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000;

// --- 共通ヘルパー --- 
async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY secret is not set.");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> {
  const parts = blob.split(":");
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error("Invalid encrypted blob format.");
  const iv = decode(parts[1]);
  const ct = decode(parts[2]);
  const key = await getKey();
  const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(decryptedData));
}

function transformRecord(record: any, userId: string, exchange: string) {
    const recordId = record.id || record.txid;
    if (!recordId) return null;

    const side = record.side || record.type; 
    const symbol = record.symbol || record.currency;
    const price = record.price ?? 0;
    const fee_cost = record.fee?.cost;
    const fee_currency = record.fee?.currency;

    if (!symbol || !side || !record.amount || !record.timestamp) return null;

    return {
        user_id: userId,
        exchange: exchange,
        trade_id: String(recordId),
        symbol: symbol,
        side: side,
        price: price,
        amount: record.amount,
        fee: fee_cost,
        fee_asset: fee_currency,
        ts: new Date(record.timestamp).toISOString(),
        raw_data: record,
    };
}

// ★★★【専門工作員(Worker)ロジック】★★★
// 単一の市場(symbol)の取引履歴を取得・保存することに特化
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // --- 司令塔からの指令を受け取る ---
        const { exchange: exchangeName, symbol } = await req.json();
        if (!exchangeName || !symbol) {
            throw new Error('exchange and symbol are required.');
        }

        // --- ユーザー認証とAPIキー取得 ---
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);
        
        const credentials = await decryptBlob(conn.encrypted_blob!);
        
        // --- CCXTインスタンス化 ---
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({
            apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase,
        });

        // --- 単一市場の取引履歴を取得 ---
        console.log(`[WORKER] Fetching trades for ${exchangeName} - ${symbol}...`);
        const trades = await exchangeInstance.fetchMyTrades(symbol, NINETY_DAYS_AGO);

        if (!trades || trades.length === 0) {
            console.log(`[WORKER] No trades found for ${symbol}.`);
            return new Response(JSON.stringify({ message: `Sync complete for ${symbol}.`, savedCount: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[WORKER] Found ${trades.length} trades for ${symbol}.`);

        // --- 取得したデータをDB形式に変換 & 保存 ---
        const transformed = trades.map(r => transformRecord(r, user.id, exchangeName)).filter(r => r !== null);
        
        if (transformed.length === 0) {
             return new Response(JSON.stringify({ message: `Sync complete for ${symbol}.`, savedCount: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(transformed, { onConflict: 'user_id,exchange,trade_id' }).select();

        if (error) {
            console.error("[WORKER-CRASH] DATABASE UPSERT FAILED:", error);
            throw error;
        }

        console.log(`[WORKER] Successfully saved ${data?.length ?? 0} records for ${symbol}.`);

        return new Response(JSON.stringify({ message: `Sync complete for ${symbol}.`, savedCount: data?.length ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error(`[WORKER-CRASH] A critical error occurred:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
