// supabase/functions/exchange-save-keys/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { b64encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

// 他の正常な関数で実績のあるCORSヘッダー定義
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- 暗号化ロジック (変更なし) ---
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
  return `v1:${b64encode(iv)}:${b64encode(ct)}`;
}
// --- 暗号化ロジックここまで ---

type SaveBody = {
  exchange: "binance" | "bybit" | "okx";
  connection_name: string;
  api_key: string;
  api_secret: string;
  api_passphrase?: string;
};

// --- [最重要修正] ここからが完全なサーバー処理です ---
Deno.serve(async (req) => {
  // プリフライトリクエスト(OPTIONS)に正しく応答
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ユーザー認証
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("User not found. Please log in.");

    // 管理者権限でSupabaseクライアントを初期化
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // リクエストボディをパース
    const body = (await req.json()) as SaveBody;
    if (!body.connection_name || !body.api_key || !body.api_secret) {
      throw new Error("connection_name, api_key, and api_secret are required");
    }
    
    // 資格情報を暗号化
    const enc_blob = await encryptJson({
      apiKey: body.api_key,
      apiSecret: body.api_secret,
      apiPassphrase: body.api_passphrase,
    });
    
    // データベースに保存
    const { error } = await supabaseAdmin.from("exchange_connections").upsert({
      user_id: user.id,
      exchange: body.exchange,
      connection_name: body.connection_name,
      encrypted_blob: enc_blob,
    }, {
      onConflict: "user_id,connection_name"
    }).select();

    if (error) throw error;
    
    // 成功応答
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    // エラー応答
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
