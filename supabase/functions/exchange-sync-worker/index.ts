
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

// --- DECRYPTION HELPER using EDGE_KMS_KEY ---
async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY secret is not set in environment variables.");
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
// --- END OF DECRYPTION HELPER ---

const initializeCcxt = (exchange, apiKey, apiSecret, apiPassphrase) => {
    return new (ccxt as any)[exchange]({
        apiKey,
        secret: apiSecret,
        password: apiPassphrase, // Passphrase for exchanges like KuCoin
        enableRateLimit: true,
    });
};

const getSinceTimestamp = (days = 365) => new Date(Date.now() - 1000 * 60 * 60 * 24 * days).getTime();

async function syncTradesForCredential(supabase: SupabaseClient, cred: any) {
    const { user_id, exchange, id: credentialId, encrypted_blob } = cred;
    console.log(`[WORKER] Starting 'trades' sync for user ${user_id} on exchange ${exchange}`);

    const { apiKey, apiSecret, apiPassphrase } = await decryptBlob(encrypted_blob);
    const exchangeInstance = initializeCcxt(exchange, apiKey, apiSecret, apiPassphrase);
    
    if (!exchangeInstance.has['fetchMyTrades']) {
        console.log(`[WORKER] Exchange ${exchange} does not support fetchMyTrades. Skipping.`);
        return { inserted: 0, skipped: 0 };
    }

    const allTrades = await exchangeInstance.fetchMyTrades(undefined, getSinceTimestamp());
    console.log(`[WORKER] Fetched ${allTrades.length} trades from ${exchange}.`);

    if (allTrades.length === 0) return { inserted: 0, skipped: 0 };

    const { data: existingTrades } = await supabase.from('exchange_trades').select('trade_id').eq('user_id', user_id).eq('exchange', exchange);
    const existingTradeIds = new Set(existingTrades.map(t => t.trade_id));

    const tradesToInsert = allTrades.filter(trade => !existingTradeIds.has(trade.id)).map(trade => ({
        user_id, exchange, trade_id: trade.id, symbol: trade.symbol, ts: trade.datetime,
        side: trade.side, price: trade.price, amount: trade.amount, fee: trade.fee?.cost,
        fee_currency: trade.fee?.currency, raw_data: trade,
    }));

    if (tradesToInsert.length === 0) return { inserted: 0, skipped: allTrades.length };

    console.log(`[WORKER] Inserting ${tradesToInsert.length} new trades.`);
    const { error } = await supabase.from('exchange_trades').insert(tradesToInsert);
    if (error) throw new Error(`Failed to insert trades: ${error.message}`);

    return { inserted: tradesToInsert.length, skipped: allTrades.length - tradesToInsert.length };
}

async function syncTransfersForCredential(supabase: SupabaseClient, cred: any) {
    const { user_id, exchange, id: credentialId, encrypted_blob } = cred;
    console.log(`[WORKER] Starting 'transfers' sync for user ${user_id} on exchange ${exchange}`);

    const { apiKey, apiSecret, apiPassphrase } = await decryptBlob(encrypted_blob);
    const exchangeInstance = initializeCcxt(exchange, apiKey, apiSecret, apiPassphrase);
    const since = getSinceTimestamp();
    let allTransfers = [];

    if (exchangeInstance.has['fetchTransfers']) {
        allTransfers = await exchangeInstance.fetchTransfers(undefined, since);
    } else if (exchangeInstance.has['fetchDeposits'] || exchangeInstance.has['fetchWithdrawals']) {
        if(exchangeInstance.has['fetchDeposits']) allTransfers.push(...await exchangeInstance.fetchDeposits(undefined, since));
        if(exchangeInstance.has['fetchWithdrawals']) allTransfers.push(...await exchangeInstance.fetchWithdrawals(undefined, since));
    } else {
        console.log(`[WORKER] Exchange ${exchange} supports neither fetchTransfers nor fetchDeposits/Withdrawals. Skipping.`);
        return { inserted: 0, skipped: 0 };
    }
    
    console.log(`[WORKER] Fetched ${allTransfers.length} transfers from ${exchange}.`);
    if (allTransfers.length === 0) return { inserted: 0, skipped: 0 };

    const { data: existing } = await supabase.from('wallet_transactions').select('source_id').eq('user_id', user_id).eq('source', 'exchange');
    const existingSourceIds = new Set(existing.map(t => t.source_id));

    const transfersToInsert = allTransfers.filter(t => t && t.id && !existingSourceIds.has(t.id)).map(t => ({
        user_id, source: 'exchange', source_id: t.id, ctx_id: `exchange:${t.id}`,
        ts: t.datetime, chain: t.network, tx_hash: t.txid, asset: t.currency,
        amount: t.type === 'withdrawal' ? -Math.abs(t.amount) : Math.abs(t.amount),
        fee: t.fee?.cost, raw_data: t, exchange: exchange, symbol: null,
        fee_asset: t.fee?.currency,
    }));
    
    if (transfersToInsert.length === 0) return { inserted: 0, skipped: allTransfers.length };

    console.log(`[WORKER] Inserting ${transfersToInsert.length} new transfers.`);
    const { error } = await supabase.from('wallet_transactions').insert(transfersToInsert);
    if (error) throw new Error(`Failed to insert transfers: ${error.message}`);

    return { inserted: transfersToInsert.length, skipped: allTransfers.length - transfersToInsert.length };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { credential_id, exchange, task_type } = await req.json();
        if (!credential_id || !exchange || !task_type) {
            throw new Error("Missing required params: credential_id, exchange, and task_type are required.");
        }

        console.log(`[WORKER] Received task: ${task_type} for ${exchange}`);

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        
        const { data: credInfo, error: credError } = await supabaseAdmin.from('exchange_api_credentials').select('user_id, id, exchange').eq('id', credential_id).single();
        if (credError) throw new Error(`Credential lookup failed: ${credError.message}`);

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', credInfo.user_id).eq('exchange', credInfo.exchange).single();
        if (connError) throw new Error(`Connection lookup failed: ${connError.message}`);

        const cred = { ...credInfo, encrypted_blob: conn.encrypted_blob };

        let result;
        if (task_type === 'trades') {
            result = await syncTradesForCredential(supabaseAdmin, cred);
        } else if (task_type === 'transfers') {
            result = await syncTransfersForCredential(supabaseAdmin, cred);
        } else {
            throw new Error(`Unknown task_type: ${task_type}`);
        }

        return new Response(JSON.stringify({ message: `Sync task '${task_type}' for ${exchange} completed.`, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err) {
        console.error(`[WORKER-CRASH] Unhandled exception:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
