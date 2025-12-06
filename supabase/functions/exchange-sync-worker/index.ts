
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【診断テスト：公開データ(OHLCV)の取得】★★★
// 認証が不要な「公開市場データ(fetchOHLCV)」の取得を試みることで、
// 問題が「認証」にあるのか、より基本的な部分にあるのかを切り分ける。
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const { exchange: exchangeName, task_type, symbol } = await req.json();
        if (!exchangeName || !task_type) throw new Error('exchange and task_type are required.');
        console.log(`[DIAGNOSIS] Starting task: ${task_type} for ${exchangeName} ${symbol ? `on ${symbol}`: ''}`);

        //【診断】「trade」タスクの時のみ、参考コードに倣い、認証不要の公開データを取得する
        if (task_type === 'trade') {
            if (!symbol) throw new Error('Symbol is required for trade task.');
            
            console.log(`[DIAGNOSIS] Attempting to fetch PUBLIC market data (OHLCV) for ${symbol}...`);
            
            // 認証キーを使わない「公開用」クライアントを初期化
            const publicExchange = new ccxt.binance();
            const since = publicExchange.parse8601(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

            // fetchMyTradesではなく、fetchOHLCVを呼び出す
            const ohlcv_records = await publicExchange.fetchOHLCV(symbol, '1d', since, 100);

            if (ohlcv_records && ohlcv_records.length > 0) {
                console.log(`[DIAGNOSIS] SUCCESS! Found ${ohlcv_records.length} public OHLCV records.`);
                console.log(`[DIAGNOSIS] This confirms the problem is with AUTHENTICATION on private calls.`);
                 return new Response(JSON.stringify({ 
                    message: `Diagnostic test PASSED. Found ${ohlcv_records.length} public records. The issue is confirmed to be authentication-related.` 
                }), { headers: corsHeaders });
            } else {
                console.error(`[DIAGNOSIS] FAILED. Even public data could not be fetched.`);
                console.error(`[DIAGNOSIS] The problem is more fundamental than authentication.`);
                return new Response(JSON.stringify({ message: "Diagnostic test FAILED. Could not fetch public data." }), { headers: corsHeaders, status: 500 });
            }
        }

        // trade以外のタスクは、従来通り（認証失敗する可能性が高い）
        console.log(`[DIAGNOSIS] Running other task type: ${task_type}`);
        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);
        const credentials = await decryptBlob(conn.encrypted_blob!);
        const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase, adjustForTimeDifference: true, options: { 'defaultType': 'spot' } });

        let records: any[] = [];
        const since = exchangeInstance.parse8601(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
        
        if (task_type === 'deposits') records = await exchangeInstance.fetchDeposits(undefined, since);
        else if (task_type === 'withdrawals') records = await exchangeInstance.fetchWithdrawals(undefined, since);
        else if (task_type === 'convert') records = await exchangeInstance.fetchConvertTradeHistory(undefined, since);

        if (!records || records.length === 0) {
            console.log(`[DIAGNOSIS] No private records found for task: ${task_type}. (As expected if auth is failing)`);
            return new Response(JSON.stringify({ message: "No private records found."}), { headers: corsHeaders });
        }

        console.log(`[DIAGNOSIS] Found ${records.length} private records. This is unexpected!`);
        return new Response(JSON.stringify({ message: `Found ${records.length} private records.` }), { headers: corsHeaders });

    } catch (err) {
        console.error(`[DIAGNOSIS-CRASH] Task failed:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
