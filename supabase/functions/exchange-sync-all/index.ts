
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'

// --- INLINED DECRYPT FUNCTION ---
// This function is copied directly from _shared/utils.ts to resolve bundling issues.
const decrypt = async (encryptedBlob: string): Promise<string> => {
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY is not set.');

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

    return new TextDecoder().decode(decrypted);
};
// --- END OF INLINED FUNCTION ---

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function fetchAndStoreTrades(supabase: SupabaseClient, userId: string, exchangeId: string, apiKey: string, secret: string) {
    console.log(`Starting trade sync for user: ${userId}, exchange: ${exchangeId}`);
    
    const exchange = new (ccxt as any)[exchangeId]({
        apiKey: apiKey,
        secret: secret,
        enableRateLimit: true,
    });

    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).getTime(); // Look back 1 year
    const allTrades = await exchange.fetchMyTrades(undefined, since);
    console.log(`Fetched ${allTrades.length} trades from ${exchangeId}.`);

    if (allTrades.length === 0) {
        return { inserted: 0, skipped: 0 };
    }

    const { data: existingTrades, error: existingTradesError } = await supabase
        .from('exchange_trades')
        .select('trade_id')
        .eq('user_id', userId)
        .eq('exchange', exchangeId);

    if (existingTradesError) throw new Error(`Could not query existing trades: ${existingTradesError.message}`);
    const existingTradeIds = new Set(existingTrades.map(t => t.trade_id));
    
    const tradesToInsert = allTrades.filter(trade => !existingTradeIds.has(trade.id)).map(trade => ({
        user_id: userId,
        exchange: exchangeId,
        trade_id: trade.id,
        symbol: trade.symbol,
        ts: trade.datetime,
        side: trade.side,
        price: trade.price,
        amount: trade.amount,
        fee: trade.fee?.cost,
        fee_currency: trade.side === 'buy' ? trade.cost : trade.amount * trade.price,
        value_usd: null,
        raw_data: trade,
    }));

    if (tradesToInsert.length > 0) {
        console.log(`Inserting ${tradesToInsert.length} new trades.`);
        const { error: insertError } = await supabase.from('exchange_trades').insert(tradesToInsert);
        if (insertError) throw new Error(`Failed to insert trades: ${insertError.message}`);
    }

    return { inserted: tradesToInsert.length, skipped: allTrades.length - tradesToInsert.length };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const adminSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const userSupabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { data: { user } } = await userSupabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data: credentials, error: credsError } = await adminSupabase
            .from('exchange_credentials')
            .select('id, user_id, exchange, blob')
            .eq('user_id', user.id);

        if (credsError) throw credsError;
        if (!credentials || credentials.length === 0) {
            return new Response(JSON.stringify({ message: 'No exchange credentials found for this user.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        let totalInserted = 0;
        let totalSkipped = 0;
        const errors: any[] = [];

        for (const cred of credentials) {
            try {
                const { apiKey, apiSecret } = JSON.parse(await decrypt(cred.blob));
                if (!apiKey || !apiSecret) throw new Error('Decrypted credentials are not valid.');
                
                const result = await fetchAndStoreTrades(adminSupabase, cred.user_id, cred.exchange, apiKey, apiSecret);
                totalInserted += result.inserted;
                totalSkipped += result.skipped;

            } catch (e: any) {
                console.error(`Failed to sync for user ${cred.user_id}, exchange ${cred.exchange}:`, e);
                errors.push({ exchange: cred.exchange, message: e.message });
            }
        }

        const summaryMessage = `Sync complete. Inserted: ${totalInserted}, Skipped: ${totalSkipped}. Errors: ${errors.length}`;
        return new Response(JSON.stringify({ message: summaryMessage, errors: errors }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err) {
        console.error('Critical error in exchange-sync-all function:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
