// supabase/functions/exchange-sync-worker/index.ts
// // // import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.46'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY not set.");
  return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(b64), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"]))
}

async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> {
  const p = blob.split(":");
  if (p.length !== 3 || p[0] !== 'v1') {
    try { return JSON.parse(blob); } catch { throw new Error("Invalid blob format."); }
  }
  const k = await getKey();
  const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2]));
  return JSON.parse(new TextDecoder().decode(d))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header is missing.');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const { connection_id, task_type, symbol } = await req.json();
    if (!connection_id || !task_type) throw new Error('connection_id and task_type are required.');

    const { data: conn, error: connError } = await supabaseAdmin
      .from('exchange_connections')
      .select('exchange, encrypted_blob, api_key, api_secret')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single();
    if (connError || !conn) throw new Error(`Connection not found for id: ${connection_id}`);

    const exchangeName = conn.exchange;
    console.log(`[WORKER] Task: ${task_type} for ${exchangeName} (Conn: ${connection_id}) ${symbol || ''}`);

    let credentials: any = {};
    if (conn.encrypted_blob) {
      try { credentials = await decryptBlob(conn.encrypted_blob); } catch (e) { console.warn("[WORKER] Decryption failed."); }
    }
    const apiKey = credentials.apiKey || conn.api_key;
    const apiSecret = credentials.apiSecret || conn.api_secret;
    const apiPassphrase = credentials.apiPassphrase || conn.api_passphrase;

    if (!apiKey || !apiSecret) throw new Error("Credentials missing.");
    console.log(`[WORKER] Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

    const exchangeConfig: any = {
      apiKey,
      secret: apiSecret,
      password: apiPassphrase,
      options: { 'defaultType': 'spot' },
      adjustForTimeDifference: true,
      enableRateLimit: true,
    };

    let exchangeInstance = new ccxt[exchangeName](exchangeConfig);

    // Universal Endpoint Detection for Binance (preserves regional fallback)
    if (exchangeName === 'binance') {
      const endpoints = [
        { name: 'Standard (api.binance.com)', hostname: 'api.binance.com', url: 'https://api.binance.com' },
        { name: 'Global Proxy (api.binance.me)', hostname: 'api.binance.me', url: 'https://api.binance.me' }
      ];

      let success = false;
      for (const endpoint of endpoints) {
        try {
          console.log(`[WORKER] Testing endpoint: ${endpoint.name}...`);
          exchangeConfig.hostname = endpoint.hostname;
          exchangeConfig.urls = {
            api: {
              public: `${endpoint.url}/api/v3`,
              private: `${endpoint.url}/api/v3`,
              sapi: `${endpoint.url}/sapi/v1`,
            }
          };
          exchangeInstance = new ccxt[exchangeName](exchangeConfig);
          await exchangeInstance.fetchBalance();
          console.log(`[WORKER] ${endpoint.name} SUCCESS.`);
          success = true;
          break;
        } catch (e: any) {
          console.warn(`[WORKER] ${endpoint.name} failed: ${e.message}`);
        }
      }
      if (!success) throw new Error("Binance authentication failed on all endpoints.");
    }

    let records: any[] = [];
    const since = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).getTime(); // Last 2 years (730 days)
    const limit = 1000;

    try {
      if (task_type === 'trade') {
        if (!symbol) throw new Error('Symbol required.');
        let currentSince = since;
        let allTrades: any[] = [];
        const maxPages = 5;
        for (let p = 0; p < maxPages; p++) {
          const pagedTrades = await exchangeInstance.fetchMyTrades(symbol, currentSince, limit);
          if (!pagedTrades || pagedTrades.length === 0) break;
          allTrades = [...allTrades, ...pagedTrades];
          if (pagedTrades.length < limit) break;
          // Set currentSince to the timestamp of the last trade + 1 to fetch the next page
          currentSince = pagedTrades[pagedTrades.length - 1].timestamp + 1;
          await new Promise(r => setTimeout(r, 500)); // Rate limit safety
        }
        records = allTrades;
      } else if (task_type === 'fiat') {
        const buys = await exchangeInstance.sapiGetFiatPayments({ transactionType: '0', beginTime: since }).then(r => r.data || []);
        const sells = await exchangeInstance.sapiGetFiatPayments({ transactionType: '1', beginTime: since }).then(r => r.data || []);
        records = [...buys.map(b => ({ ...b, transactionType: '0' })), ...sells.map(s => ({ ...s, transactionType: '1' }))];
      } else if (task_type === 'simple-earn') {
        const subResult = await exchangeInstance.sapiGetSimpleEarnFlexibleHistorySubscriptionRecord({ beginTime: since });
        const redResult = await exchangeInstance.sapiGetSimpleEarnFlexibleHistoryRedemptionRecord({ beginTime: since });
        records = [...(subResult.rows || []), ...(redResult.rows || [])];
      } else if (task_type === 'deposits') {
        records = await exchangeInstance.fetchDeposits(undefined, since, limit);
      } else if (task_type === 'withdrawals') {
        records = await exchangeInstance.fetchWithdrawals(undefined, since, limit);
      } else if (task_type === 'convert') {
        records = await exchangeInstance.fetchConvertTradeHistory(undefined, since, limit);
      } else if (task_type === 'transfer') {
        records = await exchangeInstance.fetchTransfers(undefined, since, limit);
      }
    } catch (e) {
      console.warn(`[WORKER] API call failed for task ${task_type}: ${e.message}`);
    }

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: "No new records.", savedCount: 0 }), { headers: corsHeaders });
    }

    const intermediateRecords: any[] = [];
    for (const r of records) {
      let rec: any = {};
      let fee_currency_val: string | null = null;

      if (task_type === 'fiat') {
        const isBuy = r.transactionType === '0';
        rec = {
          id: r.orderNo,
          symbol: isBuy ? `${r.cryptoCurrency}/${r.fiatCurrency}` : `${r.fiatCurrency}/${r.cryptoCurrency}`,
          side: isBuy ? 'buy' : 'sell',
          price: parseFloat(r.price),
          amount: parseFloat(r.obtainAmount),
          fee: parseFloat(r.totalFee),
          ts: r.createTime
        };
        fee_currency_val = r.sourceAmount;
      } else if (task_type === 'simple-earn') {
        const isSubscription = !!r.purchaseId;
        rec = {
          id: r.purchaseId || r.redeemId,
          symbol: r.asset,
          side: isSubscription ? 'earn_subscribe' : 'earn_redeem',
          price: 1,
          amount: parseFloat(r.amount),
          fee: 0,
          ts: r.time
        };
        fee_currency_val = isSubscription ? r.amount : null;
      } else {
        const isSell = r.side === 'sell';
        rec = {
          id: r.id || r.txid,
          symbol: r.symbol || r.currency,
          side: r.side || r.type,
          price: r.price,
          amount: isSell ? r.cost : r.amount,
          fee: r.fee?.cost,
          ts: r.timestamp
        };
        fee_currency_val = isSell ? String(r.amount) : String(r.cost);
        if (isSell && rec.symbol && rec.symbol.includes('/')) {
          const parts = rec.symbol.split('/');
          rec.symbol = `${parts[1]}/${parts[0]}`;
        }
      }

      // --- Valuate using DefiLlama Historical API ---
      let value_usd: number | null = null;
      if (rec.symbol && rec.amount != null) {
        const baseAsset = rec.symbol.split('/')[0].toUpperCase().trim();
        const SYMBOL_MAP: Record<string, string> = {
          'BTC': 'bitcoin', 'WBTC': 'wrapped-bitcoin', 'ETH': 'ethereum', 'WETH': 'weth',
          'USDC': 'usd-coin', 'DAI': 'dai', 'USDT': 'tether', 'SOL': 'solana', 'BNB': 'binancecoin',
          'MATIC': 'matic-network', 'AVAX': 'avalanche-2', 'FTM': 'fantom'
        };

        if (['USD', 'USDT', 'USDC', 'BUSD'].includes(baseAsset)) {
          value_usd = rec.amount;
        } else if (baseAsset === 'JPY') {
          value_usd = rec.amount * 0.0067;
        } else if (SYMBOL_MAP[baseAsset]) {
          const unixTs = Math.floor(new Date(parseInt(String(rec.ts), 10)).getTime() / 1000);
          const roundedTs = Math.floor(unixTs / 3600) * 3600;
          const llamaId = `coingecko:${SYMBOL_MAP[baseAsset]}`;

          try {
            console.log(`[VALUATION] Fetching ${llamaId} at ${roundedTs}...`);
            const priceRes = await fetch(`https://coins.llama.fi/prices/historical/${roundedTs}/${llamaId}`);
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              const price = priceData.coins?.[llamaId]?.price;
              if (price) {
                value_usd = rec.amount * price;
                console.log(`[VALUATION] Success: ${baseAsset} @ $${price} = $${value_usd}`);
              }
            }
          } catch (e) {
            console.warn(`[VALUATION] Failed for ${baseAsset}: ${e.message}`);
          }
        }

        if (value_usd === null && rec.price && rec.amount) {
          const quote = rec.symbol.split('/')[1]?.toUpperCase();
          if (['USD', 'USDT', 'USDC', 'BUSD'].includes(quote)) {
            value_usd = rec.amount * rec.price;
          } else if (quote === 'JPY') {
            value_usd = (rec.amount * rec.price) * 0.0067;
          }
        }
      }

      intermediateRecords.push({
        user_id: user.id,
        exchange: exchangeName,
        exchange_connection_id: connection_id,
        trade_id: rec.id ? String(rec.id) : null,
        symbol: rec.symbol,
        side: rec.side,
        price: rec.price ?? 0,
        amount: rec.amount ?? 0,
        fee: rec.fee ?? 0,
        fee_currency: fee_currency_val,
        ts: rec.ts,
        value_usd: value_usd,
        raw_data: r,
      });
    }

    const recordsToSave = intermediateRecords.filter(r => {
      const isValidDate = r.ts && !isNaN(new Date(parseInt(String(r.ts), 10)).getTime());
      return r.trade_id && r.symbol && isValidDate;
    }).map(r => ({ ...r, ts: new Date(parseInt(String(r.ts), 10)).toISOString() }));

    if (recordsToSave.length === 0) {
      return new Response(JSON.stringify({ message: "No savable records.", savedCount: 0 }), { headers: corsHeaders });
    }

    const { error: dbError, data: savedData } = await supabaseAdmin
      .from('exchange_trades')
      .upsert(recordsToSave, { onConflict: 'user_id,exchange,trade_id' })
      .select();
    if (dbError) throw dbError;

    console.log(`[WORKER] VICTORY! Saved ${savedData.length} records.`);
    return new Response(JSON.stringify({ message: `Saved ${savedData.length} records.`, savedCount: savedData.length }), { headers: corsHeaders });

  } catch (err) {
    console.error(`[WORK-CRASH]`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
