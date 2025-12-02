// supabase/functions/exchange-save-keys/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const ALLOW_ORIGIN = '*';
function cors(res: Response) { /* ... (変更なし) ... */ }

// --- (暗号化ロジック、serve関数は変更なし) ---
async function getKey() { /* ... */ }
async function encryptJson(obj: unknown) { /* ... */ }
type SaveBody = { /* ... */ };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return cors(new Response(null, { status: 204 }));
  }

  try {
    // --- (tryブロック内の主要ロジックは変更なし) ---
    const userClient = createClient(/* ... */);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("User not found");

    const supabaseAdmin = createClient(/* ... */);
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
        /* ... */
    }, { onConflict: "user_id,connection_name" });
    if (error) throw error;
    
    return cors(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' }}));

  } catch (e) {
    // [最重要修正] クラッシュ時に詳細なエラーログを出力する
    console.error("!!!!!! Function exchange-save-keys CRASHED !!!!!!");
    console.error("Error Message:", e.message);
    console.error("Full Error Object:", e); // これが最も重要なログ

    return cors(new Response(JSON.stringify({ 
      error: "An internal server error occurred.",
      details: String(e?.message ?? e) 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    }));
  }
});

// CORS関数の再掲 (変更なし)
function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  return new Response(res.body, { status: res.status, headers: h });
}
