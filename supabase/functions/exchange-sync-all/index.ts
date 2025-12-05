// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.46'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000;

// --- 復号ロジック ---
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


// ★★★【最終FIX・統合版】★★★
// 司令塔と兵隊を統合。推測に頼らず、全取引履歴を一括取得する堅牢なアプローチ。
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let exchangeName = 'unknown'; // for logging
    try {
        // --- 準備 (APIキー取得など) ---
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const { exchange: targetExchange } = await req.json();
        if (!targetExchange) throw new Error("Exchange is required.");
        exchangeName = targetExchange;
        
        console.log(`[ALL-SYNC] Received sync request for ${exchangeName}. User: ${user.id}`);

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);
        if (!conn.encrypted_blob) throw new Error(`Encrypted blob not found for ${exchangeName}`);

        const credentials = await decryptBlob(conn.encrypted_blob);
        
        // @ts-ignore
        const exchange = new ccxt[exchangeName]({
            apiKey: credentials.apiKey,
            secret: credentials.apiSecret,
            password: credentials.apiPassphrase,
        });

        await exchange.loadMarkets();

        // --- メインロジック：全取引履歴の取得 ---
        console.log(`[ALL-SYNC] Attempting to fetch all trades for ${exchangeName}...`);
        let allTrades: any[] = [];

        // [最重要] exchangeが「全市場の取引履歴の一括取得」をサポートしているか確認
        if (exchange.has['fetchMyTrades'] && exchange.has['fetchMyTrades'] !== false) {
            console.log(`[ALL-SYNC] ${exchangeName} supports unified fetchMyTrades. Fetching all at once.`);
            // ★★★ 最も理想的な方法 ★★★
            // symbolを指定せず、全市場の取引履歴を取得する
            const trades = await exchange.fetchMyTrades(undefined, NINETY_DAYS_AGO);
            allTrades.push(...trades);

        } else {
            // [フォールバック] 一括取得がサポートされていない場合の、旧来のロジック
            console.log(`[ALL-SYNC] ${exchangeName} does not support unified fetchMyTrades. Falling back to market-by-market fetching.`);
            
            const balance = await exchange.fetchBalance().catch(() => ({ total: {} }));
            const relevantAssets = new Set<string>();
            Object.keys(balance.total).filter(asset => balance.total[asset] > 0).forEach(asset => relevantAssets.add(asset));

            if (relevantAssets.size === 0) {
                 console.log(`[ALL-SYNC] No assets with a balance found on ${exchangeName}. Cannot determine markets.`);
            } else {
                const marketsToCheck = new Set<string>();
                const quoteCurrencies = ['USDT', 'BTC', 'BUSD', 'USDC', 'JPY', 'ETH', 'BNB'];
                relevantAssets.forEach(asset => {
                    quoteCurrencies.forEach(quote => {
                        if (asset === quote) return;
                        if (exchange.markets[`${asset}/${quote}`]?.spot) marketsToCheck.add(`${asset}/${quote}`);
                        if (exchange.markets[`${quote}/${asset}`]?.spot) marketsToCheck.add(`${quote}/${asset}`);
                    });
                });

                const marketsToFetch = Array.from(marketsToCheck);
                console.log(`[ALL-SYNC] Fallback: Found ${marketsToFetch.length} markets to fetch trades from.`);

                for (const market of marketsToFetch) {
                    try {
                        const trades = await exchange.fetchMyTrades(market, NINETY_DAYS_AGO);
                        if(trades.length > 0) {
                            console.log(`[ALL-SYNC] Fallback: Fetched ${trades.length} trades from ${market}`);
                            allTrades.push(...trades);
                        }
                    } catch (e) {
                         console.warn(`[ALL-SYNC] Fallback: Could not fetch trades for market ${market}`, e.message);
                    }
                }
            }
        }
        
        console.log(`[ALL-SYNC] Successfully fetched a total of ${allTrades.length} trades from ${exchangeName}.`);

        // ★★★ 取得した「生」の取引データを、そのまま返す
        return new Response(JSON.stringify(allTrades), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err) {
        console.error(`[ALL-SYNC CRASH - ${exchangeName}]`, err.message, err.stack);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
