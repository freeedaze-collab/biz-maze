// supabase/functions/exchange-save-keys/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import ccxt from 'https://esm.sh/ccxt@4.3.46';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY not set.");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
}

async function encryptJson(obj: unknown) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
  return `v1:${encode(iv)}:${encode(ct)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header is missing.');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const body = await req.json();
    const { exchange, connection_name, api_key, api_secret, api_passphrase, entity_id } = body;

    if (!exchange || !api_key || !api_secret) {
      throw new Error("Exchange, API key, and API secret are required.");
    }

    console.log(`[SAVE-KEYS] Validating ${exchange} for user ${user.id}...`);

    // --- Validation Logic via CCXT ---
    const exchangeConfig: any = {
      apiKey: api_key,
      secret: api_secret,
      password: api_passphrase,
      options: { 'defaultType': 'spot' },
      adjustForTimeDifference: true,
      enableRateLimit: true,
    };

    let exchangeInstance = new ccxt[exchange](exchangeConfig);

    // Special verification for Binance: Try Global/Standard and Fallback
    if (exchange === 'binance') {
      const endpoints = [
        { name: 'Standard (api.binance.com)', hostname: 'api.binance.com', url: 'https://api.binance.com' },
        { name: 'Global Proxy (api.binance.me)', hostname: 'api.binance.me', url: 'https://api.binance.me' }
      ];

      let success = false;
      let lastError = "";
      for (const endpoint of endpoints) {
        try {
          console.log(`[SAVE-KEYS] Testing ${endpoint.name}...`);
          exchangeConfig.hostname = endpoint.hostname;
          exchangeConfig.urls = {
            api: {
              public: `${endpoint.url}/api/v3`,
              private: `${endpoint.url}/api/v3`,
              sapi: `${endpoint.url}/sapi/v1`,
            }
          };
          exchangeInstance = new ccxt[exchange](exchangeConfig);
          await exchangeInstance.fetchBalance();
          console.log(`[SAVE-KEYS] ${endpoint.name} SUCCESS.`);
          success = true;
          break;
        } catch (e: any) {
          lastError = e.message;
          console.warn(`[SAVE-KEYS] ${endpoint.name} failed: ${e.message}`);
        }
      }
      if (!success) {
        throw new Error(`Authentication failed for Binance. Please check your API Key and Secret. (${lastError})`);
      }
    } else {
      // General validation for other exchanges
      try {
        await exchangeInstance.fetchBalance();
      } catch (e: any) {
        throw new Error(`Authentication failed for ${exchange}: ${e.message}`);
      }
    }

    // --- Encrypt and Save ---
    const enc_blob = await encryptJson({
      apiKey: api_key,
      apiSecret: api_secret,
      apiPassphrase: api_passphrase,
    });

    const { error: dbError } = await supabaseAdmin.from("exchange_connections").upsert({
      user_id: user.id,
      exchange: exchange,
      connection_name: connection_name || `${exchange} API`,
      encrypted_blob: enc_blob,
      entity_id: entity_id || null,
      status: 'linked',
    }, { onConflict: "user_id,connection_name" });

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ ok: true, message: "Credentials validated and saved." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("[SAVE-KEYS-ERROR]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Client error for validation failure
    });
  }
});
