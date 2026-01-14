// supabase/functions/exchange-save-keys/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

// --- 正しいCORSラッパー関数 (verify_wallet と同じ) ---
const ALLOW_ORIGIN = '*';
function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  return new Response(res.body, { status: res.status, headers: h });
}

// --- 暗号化ロジック ---
async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY secret is not set in Supabase Function settings.");
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

type SaveBody = {
  exchange: "binance" | "bybit" | "okx";
  connection_name: string;
  api_key: string;
  api_secret: string;
  api_passphrase?: string;
  entity_id?: string;
};

// --- メインのサーバー処理 ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return cors(new Response(null, { status: 204 }));
  }

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("User not found. Please log in.");

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = (await req.json()) as SaveBody;

    if (!body.connection_name || !body.api_key || !body.api_secret) {
      throw new Error("Connection name, API key, and API secret are required.");
    }

    const enc_blob = await encryptJson({
      apiKey: body.api_key,
      apiSecret: body.api_secret,
      apiPassphrase: body.api_passphrase,
    });

    const { error } = await supabaseAdmin.from("exchange_connections").upsert({
      user_id: user.id,
      exchange: body.exchange,
      connection_name: body.connection_name,
      encrypted_blob: enc_blob,
      entity_id: body.entity_id || null,
    }, { onConflict: "user_id,connection_name" });

    if (error) throw error;

    return cors(new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

  } catch (e) {
    // クラッシュ時に詳細なエラーログを出力
    console.error("!!!!!! Function exchange-save-keys CRASHED !!!!!!");
    console.error("Error Message:", e.message);
    console.error("Full Error Object:", e);

    return cors(new Response(JSON.stringify({
      error: "An internal server error occurred.",
      details: String(e?.message ?? e)
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    }));
  }
});
