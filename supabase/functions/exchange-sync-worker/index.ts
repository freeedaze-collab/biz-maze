
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'

// --- INLINED DECRYPT FUNCTION for reliability ---
// This function is the single source of truth for decryption, matching the one from _shared/utils.ts
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

    // The result of decrypt is a JSON string, so we parse it.
    return JSON.parse(new TextDecoder().decode(decrypted));
};
// --- END OF INLINED FUNCTION ---

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

async function syncTradesForCredential(supabase: SupabaseClient, credentialId: string) {
    // 1. Fetch the specific credential using the ID
    // CORRECTED: Select `encrypted_blob` instead of the non-existent `blob` column.
    const { data: cred, error: credError } = await supabase
        .from('exchange_api_credentials')
        .select('user_id, exchange, encrypted_blob')
        .eq('id', credentialId)
        .single();

    if (credError) throw new Error(`Credential lookup failed: ${credError.message}`);
    if (!cred || !cred.encrypted_blob) throw new Error(`Credential not found or blob is empty for ID: ${credentialId}`);
    
    const { user_id, exchange, encrypted_blob } = cred;

    console.log(`[WORKER] Starting sync for user ${user_id} on exchange ${exchange}`);

    // 2. Decrypt the API keys from the correct column
    const { apiKey, apiSecret } = await decrypt(encrypted_blob);
    if (!apiKey || !apiSecret) throw new Error(`Decryption failed for credential ID: ${credentialId}`);

    // 3. Initialize CCXT and fetch trades
    const exchangeInstance = new (ccxt as any)[exchange]({
        apiKey: apiKey,
        secret: apiSecret,
        enableRateLimit: true,
    });

    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).getTime(); // 1 year lookback
    const allTrades = await exchangeInstance.fetchMyTrades(undefined, since);
    console.log(`[WORKER] Fetched ${allTrades.length} trades from ${exchange}.`);

    if (allTrades.length === 0) {
        console.log("[WORKER] No new trades to insert.");
        return { inserted: 0, skipped: 0 };
    }

    // 4. Check for existing trades to avoid duplicates
    const { data: existingTrades, error: existingTradesError } = await supabase
        .from('exchange_trades')
        .select('trade_id')
        .eq('user_id', user_id)
        .eq('exchange', exchange);

    if (existingTradesError) throw new Error(`Could not query existing trades: ${existingTradesError.message}`);
    const existingTradeIds = new Set(existingTrades.map(t => t.trade_id));

    // 5. Prepare new records for insertion
    const tradesToInsert = allTrades.filter(trade => !existingTradeIds.has(trade.id)).map(trade => ({
        user_id: user_id,
        exchange: exchange,
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

    // 6. Insert new trades
    console.log(`[WORKER] Inserting ${tradesToInsert.length} new trades.`);
    const { error: insertError } = await supabase.from('exchange_trades').insert(tradesToInsert);
    if (insertError) throw new Error(`Failed to insert trades: ${insertError.message}`);

    return { inserted: tradesToInsert.length, skipped: allTrades.length - tradesToInsert.length };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { credential_id } = await req.json();
        if (!credential_id) throw new Error("'credential_id' is required in the request body.");

        // Use the admin client for all database operations in the worker
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        
        const result = await syncTradesForCredential(supabaseAdmin, credential_id);

        return new Response(JSON.stringify({ message: "Sync worker completed.", ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err) {
        console.error(`[WORKER-CRASH] Unhandled exception:`, err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
