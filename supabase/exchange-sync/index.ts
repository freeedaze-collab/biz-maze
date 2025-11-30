// supabase/functions/exchange-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

// CORSヘッダーをこのファイル内で直接定義
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

async function getKey() {
  const b64 = Deno.env.get('EDGE_KMS_KEY');
  if (!b64) throw new Error('EDGE_KMS_KEY missing');
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function decryptJson(v1_str: string) {
  const [_v, iv_b64, ct_b64] = v1_str.split(':');
  const key = await getKey();
  const iv = Uint8Array.from(atob(iv_b64), c => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ct_b64), c => c.charCodeAt(0));
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

function createBinanceSignature(params: URLSearchParams, secret: string) {
  return createHmac('sha256', secret).update(params.toString()).digest('hex');
}
async function fetchBinance(endpoint: string, params: URLSearchParams, apiKey: string, apiSecret: string) {
  params.set('timestamp', String(Date.now()));
  const signature = createBinanceSignature(params, apiSecret);
  params.set('signature', signature);
  
  const res = await fetch(`https://api.binance.com${endpoint}?${params.toString()}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(`Binance API Error (${endpoint}): ${errorBody.msg || JSON.stringify(errorBody)}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { exchange } = await req.json();

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized');
    const userId = user.id;

    const { data: creds, error: credsError } = await supabaseAdmin.from('exchange_api_credentials').select('enc_blob').eq('user_id', userId).eq('exchange', exchange).single();
    if (credsError || !creds) throw new Error(`API credentials for ${exchange} not found.`);
    
    const { apiKey, apiSecret } = await decryptJson(creds.enc_blob);
    if (!apiKey || !apiSecret) throw new Error('Decrypted keys are invalid.');

    const tradesToUpsert = [];
    
    if (exchange === 'binance') {
      const accountInfo = await fetchBinance('/api/v3/account', new URLSearchParams(), apiKey, apiSecret);
      const symbols = accountInfo.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0).map(b => `${b.asset}USDT`); // Very basic symbol discovery

      for (const symbol of symbols) {
        try {
            let lastId = 0;
            while (true) {
                const params = new URLSearchParams({ symbol, limit: '1000' });
                if (lastId > 0) params.set('fromId', String(lastId));
                
                const trades = await fetchBinance('/api/v3/myTrades', params, apiKey, apiSecret);
                if (trades.length === 0) break;

                for (const t of trades) {
                    tradesToUpsert.push({
                        user_id: userId, exchange: 'binance', trade_id: `${symbol}-${t.id}`, symbol: t.symbol,
                        side: t.isBuyer ? 'buy' : 'sell', price: parseFloat(t.price), amount: parseFloat(t.qty),
                        fee: parseFloat(t.commission), fee_asset: t.commissionAsset, ts: new Date(t.time).toISOString(), raw_data: t,
                    });
                    lastId = t.id;
                }
                if (trades.length < 1000) break;
            }
        } catch(e) { console.warn(`Could not fetch trades for symbol ${symbol}: ${e.message}`)}
      }

      const deposits = await fetchBinance('/sapi/v1/capital/deposit/hisrec', new URLSearchParams(), apiKey, apiSecret);
      for (const d of deposits) {
         tradesToUpsert.push({
              user_id: userId, exchange: 'binance', trade_id: `deposit-${d.txId}`, symbol: d.coin,
              side: 'deposit', price: 1, amount: parseFloat(d.amount), fee: 0, fee_asset: null,
              ts: new Date(d.insertTime).toISOString(), raw_data: d,
            });
      }
      
      const withdrawals = await fetchBinance('/sapi/v1/capital/withdraw/history', new URLSearchParams(), apiKey, apiSecret);
       for (const w of withdrawals) {
         tradesToUpsert.push({
              user_id: userId, exchange: 'binance', trade_id: `withdraw-${w.id}`, symbol: w.coin,
              side: 'withdraw', price: 1, amount: parseFloat(w.amount),
              fee: parseFloat(w.transactionFee), fee_asset: w.coin, ts: new Date(w.applyTime).toISOString(), raw_data: w,
            });
      }
    }
    
    if(tradesToUpsert.length === 0) {
        return new Response(JSON.stringify({ ok: true, step: 'final', count: 0, details: 'No new trades or history found.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { count, error } = await supabaseAdmin.from('exchange_trades').upsert(tradesToUpsert, { onConflict: 'user_id, exchange, trade_id' }).select();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, step: 'final', count, details: `Sync completed successfully.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, step: 'error', details: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
