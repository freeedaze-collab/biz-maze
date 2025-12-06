
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終作戦：原点回帰・工作員】★★★
// 司令部から渡された単一のタスクを実行することに特化。
// 過去の正常コードで実績のあるシンプルな `since` 戦略を採用。
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const { exchange: exchangeName, task_type, symbol } = await req.json();
        if (!exchangeName || !task_type) throw new Error('exchange and task_type are required.');
        console.log(`[WORKER] Starting task: ${task_type} for ${exchangeName} ${symbol ? `on ${symbol}`: ''}`);

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);
        
        const credentials = await decryptBlob(conn.encrypted_blob!);
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase });

        let records: any[] = [];
        const since = Date.now() - 90 * 24 * 60 * 60 * 1000; // 過去90日分

        // 司令官から与えられた単一任務を遂行
        if (task_type === 'trade') {
            if (!symbol) throw new Error('Symbol is required for trade task.');
            await exchangeInstance.loadMarkets(); // マーケット情報は都度読み込む
            records = await exchangeInstance.fetchMyTrades(symbol, since, 1000); // 1回のAPIで最大1000件取得
        } else if (task_type === 'deposits') {
            records = await exchangeInstance.fetchDeposits(undefined, since);
        } else if (task_type === 'withdrawals') {
            records = await exchangeInstance.fetchWithdrawals(undefined, since);
        } else if (task_type === 'convert') {
            // @ts-ignore
            records = await exchangeInstance.fetchConvertTradeHistory(undefined, since);
        }

        if (!records || records.length === 0) {
            console.log(`[WORKER] No records found for task: ${task_type} ${symbol || ''}`);
            return new Response(JSON.stringify({ message: "No new records.", savedCount: 0 }), { headers: corsHeaders });
        }

        console.log(`[WORKER] Found ${records.length} records for task: ${task_type} ${symbol || ''}`);

        // 過去コードの優れたデータ変換ロジックを流用
        const recordsToSave = records.map(r => {
            const recordId = r.id || r.txid;
            const side = r.side || r.type;
            let recordSymbol = r.symbol || r.currency;
            if (task_type === 'convert') recordSymbol = `${r.info.fromAsset}/${r.info.toAsset}`;

            return {
                user_id: user.id,
                exchange: exchangeName,
                trade_id: String(recordId), 
                symbol: recordSymbol,
                side: side,
                price: r.price ?? (task_type === 'convert' ? parseFloat(r.info.toAmount)/parseFloat(r.info.fromAmount) : 0),
                amount: r.amount,
                fee: r.fee?.cost,
                fee_asset: r.fee?.currency,
                ts: new Date(r.timestamp).toISOString(),
                raw_data: r,
            };
        }).filter(r => r.trade_id && r.symbol); // IDとシンボルがないものは除外

        if (recordsToSave.length === 0) {
            console.log(`[WORKER] All found records were invalid. Task complete.`);
            return new Response(JSON.stringify({ message: "No valid records to save.", savedCount: 0 }), { headers: corsHeaders });
        }

        const { error: dbError } = await supabaseAdmin.from('exchange_trades').upsert(recordsToSave, { onConflict: 'user_id,exchange,trade_id' });
        if (dbError) throw dbError;

        console.log(`[WORKER] VICTORY! Successfully saved ${recordsToSave.length} records for ${task_type} ${symbol || ''}.`);
        return new Response(JSON.stringify({ message: `Saved ${recordsToSave.length} records.` }), { headers: corsHeaders });

    } catch (err) {
        console.error(`[WORKER-CRASH] Task failed for ${req.method} ${req.url}:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
