// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000;

// --- Helper Functions (Unchanged) ---
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

// ★ MINIMAL CHANGE 3: Add 'connection_id' to the record transformer.
function transformRecord(record: any, userId: string, exchange: string, connection_id: number) { 
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
        exchange_connection_id: connection_id, // This is the only new field.
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

// This worker fetches data based on a specific task type (e.g., 'trades')
// IT MAINTAINS ALL ORIGINAL LOGIC.
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // ★ MINIMAL CHANGE 1: Expect 'connection_id' in the payload.
        const { connection_id, exchange: exchangeName, task_type } = await req.json();
        if (!connection_id || !exchangeName || !task_type) {
            throw new Error('connection_id, exchange, and task_type are required.');
        }

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('id', connection_id).single();
        if (connError || !conn) throw new Error(`Connection not found for id: ${connection_id}`);
        
        const credentials = await decryptBlob(conn.encrypted_blob!);
        
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase });

        let records: any[] = [];
        // --- This entire logic block is UNCHANGED ---
        if (task_type === 'trades') {
            console.log(`[WORKER] Fetching TRADES for ${exchangeName} (conn: ${connection_id})`);
            records = await exchangeInstance.fetchMyTrades(undefined, NINETY_DAYS_AGO);
        } else if (task_type === 'transfers') {
            console.log(`[WORKER] Fetching TRANSFERS for ${exchangeName} (conn: ${connection_id})`);
            // Note: Assuming fetchDeposits, fetchWithdrawals, or a similar method exists.
            // This part of the logic is preserved exactly as it was.
            const deposits = await exchangeInstance.fetchDeposits(undefined, NINETY_DAYS_AGO);
            const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, NINETY_DAYS_AGO);
            records = [...deposits, ...withdrawals];
        } else {
            throw new Error(`Unknown task_type: ${task_type}`);
        }
        // --- End of UNCHANGED logic block ---

        if (!records || records.length === 0) {
            return new Response(JSON.stringify({ message: `Sync complete for ${task_type}. No new records.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ★ MINIMAL CHANGE 2: Pass the 'connection_id' to the transformer.
        const transformed = records.map(r => transformRecord(r, user.id, exchangeName, connection_id)).filter(r => r !== null);
        
        if (transformed.length === 0) {
             return new Response(JSON.stringify({ message: `Sync complete for ${task_type}. Nothing to save.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // The upsert remains the same.
        const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(transformed, { onConflict: 'user_id,exchange,trade_id' }).select();

        if (error) {
            console.error(`[WORKER-CRASH] DB Upsert Failed for ${task_type}:`, error);
            throw error;
        }

        return new Response(JSON.stringify({ message: `Sync succeeded for ${task_type}.`, savedCount: data?.length ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
