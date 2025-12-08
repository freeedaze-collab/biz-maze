// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40' // 安定バージョンに固定
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// --- 共通ヘルパー (workerと重複するが、簡潔さのため各ファイルに保持) ---
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

// ★★★【司令塔(Commander)ロジック】★★★
// 取引履歴の「取得」は行わず、「調査すべき市場リスト」の作成に特化
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // --- ユーザー認証 ---
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');
        
        // [FIX] リクエストボディが空、または不正な場合に安全にエラーを返す
        let payload;
        try {
            payload = await req.json();
        } catch (e) {
            console.error("[ALL - Commander] Failed to parse JSON body:", e.message);
            return new Response(JSON.stringify({ error: "Invalid request body. Expected a JSON object with an 'exchange' key." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
            });
        }

        const { exchange: exchangeName } = payload;
        if (!exchangeName) {
            return new Response(JSON.stringify({ error: "The 'exchange' key is missing from the request body." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
            });
        }

        console.log(`[ALL - Commander] Received request for ${exchangeName}.`);

        // --- APIキー取得 ---
        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);

        const credentials = await decryptBlob(conn.encrypted_blob!);
        
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({
            apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase,
        });

        await exchangeInstance.loadMarkets();

        // --- 調査すべきアセットの洗い出し ---
        const relevantAssets = new Set<string>();
        const since = Date.now() - 90 * 24 * 60 * 60 * 1000;

        const balance = await exchangeInstance.fetchBalance().catch(() => ({ total: {} }));
        Object.keys(balance.total).filter(asset => balance.total[asset] > 0).forEach(asset => relevantAssets.add(asset));
        
        if (exchangeInstance.has['fetchDeposits']) {
            const deposits = await exchangeInstance.fetchDeposits(undefined, since).catch(() => []);
            deposits.forEach(d => relevantAssets.add(d.currency));
        }
        if (exchangeInstance.has['fetchWithdrawals']) {
            const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since).catch(() => []);
            withdrawals.forEach(w => relevantAssets.add(w.currency));
        }

        console.log(`[ALL - Commander] Found ${relevantAssets.size} relevant assets for ${exchangeName}.`);

        // --- 市場リストの作成 ---
        const symbolsToFetch = new Set<string>();
        const quoteCurrencies = ['JPY', 'USDT', 'BTC', 'ETH', 'BUSD', 'USDC', 'BNB'];
        relevantAssets.forEach(asset => {
            quoteCurrencies.forEach(quote => {
                if (asset === quote) return;
                if (exchangeInstance.markets[`${asset}/${quote}`]) symbolsToFetch.add(`${asset}/${quote}`);
                if (exchangeInstance.markets[`${quote}/${asset}`]) symbolsToFetch.add(`${quote}/${asset}`);
            });
        });
        
        const symbolList = Array.from(symbolsToFetch);
        console.log(`[ALL - Commander] Created a plan with ${symbolList.length} symbols for ${exchangeName}.`);

        // --- 作戦計画書(市場リスト)を返す ---
        return new Response(JSON.stringify({ symbols: symbolList }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error(`[ALL - Commander CRASH]`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 
        });
    }
});
