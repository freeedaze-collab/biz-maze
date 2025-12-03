// supabase/functions/exchange-sync-all/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { /* ... (VCE.tsx と同じCORSヘッダー) ... */ };

// --- 復号ロジック (VCE.tsx と同じ) ---
async function getKey() { /* ... */ }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret:string; apiPassphrase?:string; }> { /* ... */ }


// --- メインのサーバー処理 ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('User not found.');

    const { data: connections, error: connError } = await supabaseAdmin
      .from('exchange_connections')
      .select('id, exchange, encrypted_blob')
      .eq('user_id', user.id);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: "No exchange connections found.", totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let totalSavedCount = 0;
    const allTrades = [];

    for (const conn of connections) {
      if (!conn.encrypted_blob) continue;
      
      const credentials = await decryptBlob(conn.encrypted_blob);
      const exchangeInstance = new ccxt[conn.exchange]({
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret,
        password: credentials.apiPassphrase,
      });

      const trades = await exchangeInstance.fetchMyTrades();
      if (trades.length > 0) {
        const tradesToUpsert = trades.map(trade => ({ /* ... (VCE.tsx と同じtradeオブジェクト) ... */ }));
        allTrades.push(...tradesToUpsert);
      }
    }
    
    if (allTrades.length > 0) {
      const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(allTrades, { onConflict: 'user_id, exchange, trade_id' }).select();
      if (error) throw error;
      totalSavedCount = data?.length ?? 0;
    }

    return new Response(JSON.stringify({ message: `Sync complete.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`!!!!!! Exchange Sync All Error !!!!!!`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
