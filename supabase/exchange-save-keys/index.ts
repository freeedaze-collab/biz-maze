// supabase/functions/exchange-save-keys/index.ts
// 依存は supabase-js@2 のみ。Edge で動作。暗号化は AES-GCM。
// 秘密鍵は EDGE_KMS_KEY (base64 の 32byte) を Edge Function Secrets に設定してください。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- CORS ----
const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});

// ---- AES-GCM Utilities ----
function b64enc(u8: Uint8Array) { return btoa(String.fromCharCode(...u8)); }
function b64dec(b64: string) {
  const s = atob(b64); const u = new Uint8Array(s.length);
  for (let i=0;i<s.length;i++) u[i] = s.charCodeAt(i);
  return u;
}

async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY missing");
  const raw = b64dec(b64); // 32 bytes 推奨
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
}

async function encryptJson(obj: any) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  return `v1:${b64enc(iv)}:${b64enc(new Uint8Array(ct))}`;
}

// ---- Handler ----
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors(origin) });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 認証（JWT必須）
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no_token", hint: "Sign-in required" }), { status: 401, headers: cors(origin) });
    }
    const token = authz.slice("Bearer ".length);
    const { data: u } = await supabase.auth.getUser(token);
    const userId = u?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "bad_token", hint: "Session expired?" }), { status: 401, headers: cors(origin) });
    }

    // 入力
    const body = await req.json().catch(() => null);
    if (!body) return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: cors(origin) });

    const exchange = body.exchange as "binance"|"bybit"|"okx";
    const external_user_id = body.external_user_id ?? null;
    const apiKey = body.apiKey as string | undefined;
    const apiSecret = body.apiSecret as string | undefined;
    const passphrase = body.passphrase as string | undefined;

    // 検証
    if (!exchange || !["binance","bybit","okx"].includes(exchange)) {
      return new Response(JSON.stringify({ error: "bad_exchange", hint: "binance|bybit|okx" }), { status: 400, headers: cors(origin) });
    }
    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "missing_keys", hint: "apiKey/apiSecret required" }), { status: 400, headers: cors(origin) });
    }
    if (exchange === "okx" && !passphrase) {
      return new Response(JSON.stringify({ error: "missing_passphrase", hint: "OKX requires passphrase" }), { status: 400, headers: cors(origin) });
    }

    // 暗号化して保存
    const enc_blob = await encryptJson({
      apiKey, apiSecret, apiPassphrase: passphrase ?? null,
    });

    // 資格情報を upsert
    const { error: e1 } = await supabase
      .from("exchange_api_credentials")
      .upsert(
        { user_id: userId, exchange, external_user_id, enc_blob },
        { onConflict: "user_id,exchange" }
      );
    if (e1) throw e1;

    // 接続状態を upsert
    const { error: e2 } = await supabase
      .from("exchange_connections")
      .upsert(
        { user_id: userId, exchange, external_user_id, status: "linked_keys" },
        { onConflict: "user_id,exchange" }
      );
    if (e2) throw e2;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors(origin) });
  } catch (e) {
    // サーバ内エラーも本文に詳細を返す
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: cors(origin) });
  }
});