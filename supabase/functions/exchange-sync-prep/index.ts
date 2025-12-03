
// supabase/functions/exchange-sync-prep/index.ts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// --- 共通の認証・復号ロジック ---
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

    // Symbolsは受け取らない
    const { exchange, since: sinceStr, until } = await req.json();
    if (!exchange) throw new Error("Exchange is not specified");

    const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchange).single();
    if (connError || !conn) throw new Error(`Connection not found for ${exchange}`);
    if (!conn.encrypted_blob) throw new Error(`Blob not found for ${exchange}`);

    const credentials = await decryptBlob(conn.encrypted_blob);
    const exchangeInstance = new ccxt[exchange]({
      apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase,
    });

    const since = sinceStr ? new Date(sinceStr).getTime() : undefined;
    let deposits: any[] = [];
    let withdrawals: any[] = [];

    // 1. 入出金履歴を取得
    console.log(`[PREP] Fetching deposits and withdrawals for ${exchange}...`);
    if (exchangeInstance.has['fetchDeposits']) {
        deposits = await exchangeInstance.fetchDeposits(undefined, since, undefined, { until });
    }
    if (exchangeInstance.has['fetchWithdrawals']) {
        withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since, undefined, { until });
    }

    // 2. 全ての市場リストを作成
    console.log(`[PREP] Fetching all markets for ${exchange}...`);
    await exchangeInstance.loadMarkets();
    const marketsToFetch = exchangeInstance.symbols;

    console.log(`[PREP] Found ${deposits.length} deposits, ${withdrawals.length} withdrawals, and ${marketsToFetch.length} markets to sync.`);

    return new Response(JSON.stringify({ marketsToFetch, deposits, withdrawals }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[PREP CRASH]`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
