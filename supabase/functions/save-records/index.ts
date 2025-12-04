
// supabase/functions/save-records/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// This function transforms the raw ccxt record into the format our DB expects.
// It was previously inside the monolithic exchange-sync-all function.
function transformRecord(record: any, userId: string, exchange: string) {
    const recordId = record.id || record.txid;
    if (!recordId) {
      console.warn("[TRANSFORM-WARN] Record is missing a unique ID. Skipping:", record);
      return null;
    }
  
    const side = record.side || record.type;
    // Unify symbol/currency field for trades, deposits, and withdrawals
    const symbol = record.symbol || record.currency;
    const price = record.price ?? 0;
    const fee_cost = record.fee?.cost;
    const fee_currency = record.fee?.currency;
  
    if (!symbol || !side || !record.amount || !record.timestamp) {
        console.warn(`[TRANSFORM-WARN] Record is missing required fields. Skipping:`, record);
        return null;
    }
  
    return {
      user_id: userId,
      exchange: exchange,
      trade_id: String(recordId),
      symbol: symbol,
      side: side,
      price: price,
      amount: record.amount,
      fee: fee_cost,
      fee_asset: fee_currency,
      ts: new Date(record.timestamp).toISOString(),
      raw_data: record, // Keep the original data for debugging or re-processing
    };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
    if (userError || !user) throw new Error('User not found.')

    const { records, exchange } = await req.json();

    if (!records || !Array.isArray(records)) {
        throw new Error("Invalid request body: 'records' array is required.");
    }
    if (!exchange) {
        throw new Error("Invalid request body: 'exchange' is required.");
    }

    if (records.length === 0) {
        return new Response(JSON.stringify({ message: `No new records to save for ${exchange}.`, totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[LOG] Received ${records.length} records from frontend for user ${user.id} and exchange ${exchange}.`);
    
    // Transform all records into the database schema format
    const transformedRecords = records.map(r => transformRecord(r, user.id, exchange)).filter(r => r !== null);

    if (transformedRecords.length === 0) {
        console.log("[LOG] All records were filtered out during transformation. Nothing to save.");
        return new Response(JSON.stringify({ message: "No valid records to save.", totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[LOG] Upserting ${transformedRecords.length} transformed records to the database...`);
      
    const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(transformedRecords, {
      onConflict: 'user_id,exchange,trade_id'
    }).select();

    if (error) {
        console.error("[CRASH] DATABASE UPSERT FAILED:", error);
        throw error;
    }
    
    const totalSavedCount = data?.length ?? 0;
    console.log(`[LOG] VICTORY! Successfully upserted ${totalSavedCount} records for ${exchange}.`);

    return new Response(JSON.stringify({ message: `Save complete for ${exchange}.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] In save-records:`, err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
