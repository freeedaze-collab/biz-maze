
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Exchange, Market, Trade, Transaction, Transfer } from 'https://esm.sh/ccxt@4.3.40'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

// ★★★【修正】★★★ `cors.ts` への依存を排除するため、内容を直接埋め込む
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 復号化＆CCXTインスタンス化のためのヘルパー関数
async function getCcxtInstance(user_id: string, exchangeName: string, supabaseAdmin: SupabaseClient): Promise<Exchange> {
    console.log(`[WORK] Getting CCXT for user: ${user_id}, exchange: ${exchangeName}`);
    const { data, error } = await supabaseAdmin.from('exchange_connections').select('id, api_key_encrypted').eq('user_id', user_id).eq('exchange', exchangeName).single();
    if (error || !data) {
        console.error(`[WORK] API key retrieval error for ${exchangeName}:`, error);
        throw new Error(`Connection not found for ${exchangeName}`);
    }

    const p = data.api_key_encrypted.split(":");
    const k = await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"]);
    const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2]));
    const credentials = JSON.parse(new TextDecoder().decode(d));

    // @ts-ignore
    const ccxt = await import('https://esm.sh/ccxt@4.3.40');
    // @ts-ignore
    const exchangeInstance = new ccxt[exchangeName]({
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret,
        password: credentials.apiPassphrase,
    });
    return exchangeInstance;
}

// 各タスクのハンドラ...
// (省略：ここは変更なし)
async function handleTradeSync(user_id: string, exchange: string, symbol: string, supabaseAdmin: SupabaseClient, ccxt: Exchange): Promise<number> {
    console.log(`[WORK] Fetching trades for ${symbol}...`);
    const since = await supabaseAdmin.rpc('get_last_trade_ts_for_symbol', { p_user_id: user_id, p_exchange: exchange, p_symbol: symbol });
    const trades = await ccxt.fetchMyTrades(symbol, since.data || undefined);
    if (trades.length === 0) return 0;

    console.log(`[WORK] Found ${trades.length} new trades for ${symbol}. Saving...`);
    const records = trades.map((t: Trade) => ({
        user_id: user_id,
        exchange: exchange,
        trade_id: t.id,
        order_id: t.order,
        symbol: t.symbol,
        ts: t.datetime,
        price: t.price,
        amount: t.amount,
        cost: t.cost,
        fee_cost: t.fee?.cost,
        fee_currency: t.fee?.currency,
        side: t.side,
        raw: t,
    }));
    const { error } = await supabaseAdmin.from('exchange_trades').upsert(records, { onConflict: 'user_id,exchange,trade_id' });
    if (error) throw new Error(`DB save failed for ${symbol}: ${error.message}`);
    return records.length;
}

async function handleNonTradeSync(user_id: string, exchange: string, supabaseAdmin: SupabaseClient, ccxt: Exchange): Promise<number> {
    let totalSaved = 0;
    // (中略)
    return totalSaved;
}


// メインのDeno serveハンドラ
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    let final_user_id: string | null = null;

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        const { exchange, symbol, task_type, user_id } = await req.json();

        // ★★★【修正】★★★ user_id の処理を単純化・確実化
        if (user_id) {
            console.log("[WORK] Received user_id in body, using it.");
            final_user_id = user_id;
        } else {
            console.log("[WORK] No user_id in body, falling back to Authorization header.");
            const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
            if (userError || !user) throw new Error('User not found from token.');
            final_user_id = user.id;
        }

        if (!final_user_id) throw new Error('Critical: User ID could not be determined.');
        if (!exchange || !task_type) throw new Error('exchange and task_type are required.');
        
        const ccxt = await getCcxtInstance(final_user_id, exchange, supabaseAdmin);
        await ccxt.loadMarkets();
        let savedCount = 0;

        if (task_type === 'trade') {
            if (!symbol) throw new Error('Symbol is required for trade sync.');
            savedCount = await handleTradeSync(final_user_id, exchange, symbol, supabaseAdmin, ccxt);
        } else if (task_type === 'non-trade') {
            savedCount = await handleNonTradeSync(final_user_id, exchange, supabaseAdmin, ccxt);
        } else {
            throw new Error(`Unknown task_type: ${task_type}`);
        }

        return new Response(JSON.stringify({ savedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

    } catch (err) {
        console.error(`[WORK-CRASH]`, { error: err.message, stack: err.stack });
        return new Response(JSON.stringify({ error: `Unhandled exception for ${req.method} ${req.url}: ${err.message}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
