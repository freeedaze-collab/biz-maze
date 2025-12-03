// supabase/functions/exchange-sync-all/index.ts

import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const { data: connections, error: connError } = await supabaseAdmin.from('exchange_connections').select('id, exchange, encrypted_blob').eq('user_id', user.id);
    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: "No exchange connections found.", totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allRecordsToUpsert = [];
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000; 

    for (const conn of connections) {
      console.log(`[LOG] Processing ${conn.exchange}...`);
      if (!conn.encrypted_blob) { console.warn(`[WARN] Skipping ${conn.exchange} due to missing blob.`); continue; }
      
      const credentials = await decryptBlob(conn.encrypted_blob);
      const exchangeInstance = new ccxt[conn.exchange]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase });
      let ledgerRecords = [];
      
      // [最終最重要修正] fetchMyTrades を捨て、全ての資産の動きを記録する fetchLedger を使う
      console.log(`[LOG] Using fetchLedger to get ALL account activities (trades, withdrawals, etc.) since ${new Date(since).toISOString()}`);
      
      try {
        // fetchLedger はシンボルを必要とせず、全てのアカウント台帳を取得する
        const records = await exchangeInstance.fetchLedger(undefined, since);
        if (records.length > 0) {
          console.log(`[LOG] SUCCESS! fetchLedger found ${records.length} records for ${conn.exchange}.`);
          ledgerRecords.push(...records);
        } else {
          console.log(`[LOG] fetchLedger found 0 records for this period. (This might be normal)`);
        }
      } catch (e) {
        console.error(`[CRASH] fetchLedger failed for ${conn.exchange}. This exchange might not support it.`, e.message);
        // fetchLedger が失敗した場合のフォールバックとして fetchMyTrades を試す（念のため）
        console.log(`[LOG] Fallback: Trying fetchMyTrades for ${conn.exchange}`);
        try {
            const trades = await exchangeInstance.fetchMyTrades(undefined, since);
            if (trades.length > 0) {
                console.log(`[LOG] Fallback SUCCESS! Found ${trades.length} trades.`);
                ledgerRecords.push(...trades);
            }
        } catch (tradeError) {
             console.error(`[CRASH] Fallback fetchMyTrades also failed.`, tradeError.message);
        }
      }

      console.log(`[LOG] Found a total of ${ledgerRecords.length} records for ${conn.exchange}.`);
      if (ledgerRecords.length > 0) {
        // ledger の各レコードに一意のIDがあることを期待し、raw_dataとして保存
        allRecordsToUpsert.push(...ledgerRecords.map(record => ({ 
            user_id: user.id, 
            exchange: conn.exchange, 
            raw_data: record 
        })));
      }
    }
    
    let totalSavedCount = 0;
    if (allRecordsToUpsert.length > 0) {
      console.log(`[LOG] Upserting ${allRecordsToUpsert.length} records to the database...`);
      // raw_data->>'id' がコンフリクトキーとして機能することを期待
      const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(allRecordsToUpsert, { onConflict: "user_id,exchange,(raw_data->>'id')" }).select();
      if (error) throw error;
      totalSavedCount = data?.length ?? 0;
      console.log(`[LOG] VICTORY! Successfully upserted ${totalSavedCount} records.`);
    } else {
      console.log("[LOG] No new records found across all exchanges to save.");
    }

    return new Response(JSON.stringify({ message: `Sync complete.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in the function:`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
