// supabase/functions/exchange-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- 復号ロジック (exchange-save-keysと対になる) ---
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

// --- メインのサーバー処理 ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { connection_id } = await req.json();
    if (!connection_id) throw new Error("connection_id is required.");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('User not found.');

    const { data: conn, error: connError } = await supabaseAdmin
      .from('exchange_connections')
      .select('exchange, encrypted_blob')
      .eq('user_id', user.id)
      .eq('id', connection_id)
      .single();

    if (connError || !conn || !conn.encrypted_blob) {
      throw new Error(`Connection not found or is incomplete.`);
    }

    const credentials = await decryptBlob(conn.encrypted_blob);
    const exchangeOptions = {
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase, // for OKX
    };
    
    const exchangeInstance = new ccxt[conn.exchange](exchangeOptions);
    const trades = await exchangeInstance.fetchMyTrades();

    if (trades.length === 0) {
      return new Response(JSON.stringify({ message: 'No new trades found.', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tradesToUpsert = trades.map(trade => ({ /* ... (変更なし) ... */ }));
    const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(tradesToUpsert, { onConflict: 'user_id, exchange, trade_id' }).select();

    if (error) throw error;
    
    return new Response(JSON.stringify({ message: `Sync successful.`, count: data?.length ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`!!!!!! Exchange Sync Error !!!!!!`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
