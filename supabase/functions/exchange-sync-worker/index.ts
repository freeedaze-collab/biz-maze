
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'

// --- INLINED DECRYPT FUNCTION for reliability ---
const decrypt = async (encryptedBlob: string): Promise<{ apiKey: string; apiSecret: string; }> => {
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY is not set in environment variables.');

    const keyBuffer = Uint8Array.from(atob(encryptionKey), c => c.charCodeAt(0));
    const importedKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const data = JSON.parse(atob(encryptedBlob));
    const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        importedKey,
        ciphertext
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
};
// --- END OF INLINED FUNCTION ---

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

const initializeCcxt = (exchange, apiKey, apiSecret) => {
    return new (ccxt as any)[exchange]({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
    });
};

const getSinceTimestamp = () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).getTime(); // 1 year lookback as a default

async function syncTradesForCredential(supabase: SupabaseClient, cred: any) {
    const { user_id, exchange, id: credentialId, encrypted_blob } = cred;
    console.log(`[WORKER] Starting 'trades' sync for user ${user_id} on exchange ${exchange}`);

    const { apiKey, apiSecret } = await decrypt(encrypted_blob);
    if (!apiKey || !apiSecret) throw new Error(`Decryption failed for credential ID: ${credentialId}`);

    const exchangeInstance = initializeCcxt(exchange, apiKey, apiSecret);
    
    if (!exchangeInstance.has['fetchMyTrades']) {
        console.log(`[WORKER] Exchange ${exchange} does not support fetchMyTrades. Skipping.`);
        return { inserted: 0, skipped: 0 };
    }

    const allTrades = await exchangeInstance.fetchMyTrades(undefined, getSinceTimestamp());
    console.log(`[WORKER] Fetched ${allTrades.length} trades from ${exchange}.`);

    if (allTrades.length === 0) {
        console.log("[WORKER] No new trades to insert.");
        return { inserted: 0, skipped: 0 };
    }

    const { data: existingTrades, error: existingTradesError } = await supabase
        .from('exchange_trades')
        .select('trade_id')
        .eq('user_id', user_id)
        .eq('exchange', exchange);

    if (existingTradesError) throw new Error(`Could not query existing trades: ${existingTradesError.message}`);
    const existingTradeIds = new Set(existingTrades.map(t => t.trade_id));

    const tradesToInsert = allTrades.filter(trade => !existingTradeIds.has(trade.id)).map(trade => ({
        user_id,
        exchange,
        trade_id: trade.id,
        symbol: trade.symbol,
        ts: trade.datetime,
        side: trade.side,
        price: trade.price,
        amount: trade.amount,
        fee: trade.fee?.cost,
        fee_currency: trade.fee?.currency,
        raw_data: trade,
    }));

    if (tradesToInsert.length === 0) {
        console.log("[WORKER] All fetched trades already exist in the database.");
        return { inserted: 0, skipped: allTrades.length };
    }

    console.log(`[WORKER] Inserting ${tradesToInsert.length} new trades.`);
    const { error: insertError } = await supabase.from('exchange_trades').insert(tradesToInsert);
    if (insertError) throw new Error(`Failed to insert trades: ${insertError.message}`);

    return { inserted: tradesToInsert.length, skipped: allTrades.length - tradesToInsert.length };
}


async function syncTransfersForCredential(supabase: SupabaseClient, cred: any) {
    const { user_id, exchange, id: credentialId, encrypted_blob } = cred;
    console.log(`[WORKER] Starting 'transfers' sync for user ${user_id} on exchange ${exchange}`);

    const { apiKey, apiSecret } = await decrypt(encrypted_blob);
    if (!apiKey || !apiSecret) throw new Error(`Decryption failed for credential ID: ${credentialId}`);

    const exchangeInstance = initializeCcxt(exchange, apiKey, apiSecret);
    const since = getSinceTimestamp();
    let allTransfers = [];

    if (exchangeInstance.has['fetchTransfers']) {
        allTransfers = await exchangeInstance.fetchTransfers(undefined, since);
    } else if (exchangeInstance.has['fetchDeposits'] || exchangeInstance.has['fetchWithdrawals']) {
        console.log(`[WORKER] ${exchange} does not support fetchTransfers, falling back to fetchDeposits/fetchWithdrawals.`);
        if(exchangeInstance.has['fetchDeposits']) {
            const deposits = await exchangeInstance.fetchDeposits(undefined, since);
            allTransfers.push(...deposits);
        }
        if(exchangeInstance.has['fetchWithdrawals']) {
            const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since);
            allTransfers.push(...withdrawals);
        }
    } else {
        console.log(`[WORKER] Exchange ${exchange} does not support fetching transfers. Skipping.`);
        return { inserted: 0, skipped: 0 };
    }
    
    console.log(`[WORKER] Fetched ${allTransfers.length} transfers from ${exchange}.`);
    if (allTransfers.length === 0) {
        console.log("[WORKER] No new transfers to insert.");
        return { inserted: 0, skipped: 0 };
    }

    const existingSourceIds = new Set(
        (await supabase.from('wallet_transactions').select('source_id').eq('user_id', user_id)).data.map(t => t.source_id)
    );

    const transfersToInsert = allTransfers.filter(t => t && t.id && !existingSourceIds.has(t.id)).map(t => ({
        user_id,
        source: 'exchange',
        source_id: t.id,
        ctx_id: `exchange_transfer:${t.id}`,
        ts: t.datetime,
        chain: t.network,
        tx_hash: t.txid,
        asset: t.currency,
        amount: t.type === 'withdrawal' ? -Math.abs(t.amount) : Math.abs(t.amount),
        fee: t.fee?.cost,
        raw_data: t,
        // These fields are specific to exchange_trades, so set to null
        exchange: exchange,
        symbol: null, 
        fee_asset: t.fee?.currency,
    }));
    
    if (transfersToInsert.length === 0) {
        console.log("[WORKER] All fetched transfers already exist in the database.");
        return { inserted: 0, skipped: allTransfers.length };
    }

    console.log(`[WORKER] Inserting ${transfersToInsert.length} new transfers into wallet_transactions.`);
    const { error: insertError } = await supabase.from('wallet_transactions').insert(transfersToInsert);
    if (insertError) throw new Error(`Failed to insert transfers: ${insertError.message}`);

    return { inserted: transfersToInsert.length, skipped: allTransfers.length - transfersToInsert.length };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { credential_id, exchange, task_type } = await req.json();
        if (!credential_id || !exchange || !task_type) {
            throw new Error("Missing required params: credential_id, exchange, and task_type are required.");
        }

        console.log(`[WORKER] Starting task: ${task_type} for ${exchange}`);

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Step 1: Look up the credential details from exchange_api_credentials
        const { data: credInfo, error: credError } = await supabaseAdmin
            .from('exchange_api_credentials')
            .select('user_id, id, exchange')
            .eq('id', credential_id)
            .single();

        if (credError) throw new Error(`Credential lookup failed in exchange_api_credentials: ${credError.message}`);
        if (!credInfo) throw new Error(`Credential not found in exchange_api_credentials for ID: ${credential_id}`);

        // Step 2: Fetch the encrypted blob from the correct table, exchange_connections
        const { data: conn, error: connError } = await supabaseAdmin
            .from('exchange_connections')
            .select('encrypted_blob')
            .eq('user_id', credInfo.user_id)
            .eq('exchange', credInfo.exchange)
            .single();

        if (connError) throw new Error(`Connection lookup failed in exchange_connections: ${connError.message}`);
        if (!conn || !conn.encrypted_blob) throw new Error(`Encrypted blob not found in exchange_connections for user ${credInfo.user_id} and exchange ${credInfo.exchange}`);

        // Step 3: Combine the information to form the final credential object
        const cred = {
            ...credInfo,
            encrypted_blob: conn.encrypted_blob
        };

        let result;
        switch (task_type) {
            case 'trades':
                result = await syncTradesForCredential(supabaseAdmin, cred);
                break;
            case 'transfers':
                result = await syncTransfersForCredential(supabaseAdmin, cred);
                break;
            default:
                throw new Error(`Unknown task_type: ${task_type}`);
        }

        return new Response(JSON.stringify({ message: `Sync task '${task_type}' completed.`, ...result }), {
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
