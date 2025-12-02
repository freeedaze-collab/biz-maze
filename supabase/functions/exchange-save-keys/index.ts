// supabase/functions/exchange-save-keys/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// [最重要修正] 正しい関数 `encode` をインポートします
import { encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

// --- `verify_wallet`と全く同じCORSラッパー関数 (変更なし) ---
const ALLOW_ORIGIN = '*';
function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  return new Response(res.body, { status: res.status, headers: h });
}
// --- CORSラッパーここまで ---


// --- 暗号化ロジック ---
async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY is not set in environment variables.");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
}

async function encryptJson(obj: unknown) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
  // [最重要修正] 正しい関数 `encode` を使用します
  return `v1:${encode(iv)}:${encode(ct)}`;
}
// --- 暗号化ロジックここまで ---

type SaveBody = {
  exchange: "binance" | "bybit" | "okx";
  connection_name: string;
  api_key: string;
  api_secret: string;
  api_passphrase?: string;
};

// --- `verify_wallet`と全く同じ`Deno.serve`構造 (変更なし) ---
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
      throw new Error("connection_name, api_key, and api_secret are required");
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
    }, { onConflict: "user_id,connection_name" });

    if (error) throw error;
    
    return cors(new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));
  } catch (e) {
    return cors(new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    }));
  }
});
