// supabase/functions/exchange-binance-proxy/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ccxt from 'https://esm.sh/ccxt@4.3.46';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 認証
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header is missing.');
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { apiKey, apiSecret, apiPassphrase } = body;

    if (!apiKey || !apiSecret) {
      throw new Error("API Key and Secret are required.");
    }

    console.log(`[PROXY] Testing Binance connection for user ${user.id}...`);

    const exchangeConfig: any = {
      apiKey,
      secret: apiSecret,
      password: apiPassphrase,
      options: { 'defaultType': 'spot' },
      adjustForTimeDifference: true,
      enableRateLimit: true,
    };

    let exchangeInstance: any;
    const endpoints = [
      { name: 'Standard (api.binance.com)', hostname: 'api.binance.com', url: 'https://api.binance.com' },
      { name: 'Global Proxy (api.binance.me)', hostname: 'api.binance.me', url: 'https://api.binance.me' }
    ];

    let success = false;
    let lastError = "";

    for (const endpoint of endpoints) {
      try {
        console.log(`[PROXY] Testing ${endpoint.name}...`);
        exchangeConfig.hostname = endpoint.hostname;
        exchangeConfig.urls = {
          api: {
            public: `${endpoint.url}/api/v3`,
            private: `${endpoint.url}/api/v3`,
            sapi: `${endpoint.url}/sapi/v1`,
          }
        };
        exchangeInstance = new ccxt.binance(exchangeConfig);
        await exchangeInstance.fetchBalance();
        console.log(`[PROXY] ${endpoint.name} SUCCESS.`);
        success = true;
        break;
      } catch (e: any) {
        lastError = e.message;
        console.warn(`[PROXY] ${endpoint.name} failed: ${e.message}`);
      }
    }

    if (!success) {
      return new Response(JSON.stringify({ ok: false, error: lastError }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 with ok:false to let adapter handle it
      });
    }

    return new Response(JSON.stringify({ ok: true, message: "Connection successful" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("[PROXY-ERROR]", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
