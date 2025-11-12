// supabase/functions/exchange-save-keys/index.ts
// 依存なし（edge-runtime の import は不要）
// AES-GCM で {apiKey, apiSecret, apiPassphrase?} を暗号化保存
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SaveBody = {
  exchange: "binance" | "bybit" | "okx";
  external_user_id?: string;
  api_key: string;
  api_secret: string;
  api_passphrase?: string; // OKX用
};

async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY missing");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
function b64encode(u8: Uint8Array) {
  let s = ""; u8.forEach(c => s += String.fromCharCode(c));
  return btoa(s);
}
async function encryptJson(obj: unknown) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
  return `v1:${b64encode(iv)}:${b64encode(ct)}`;
}

const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: cors(origin) });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 認証
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "no token" }), { status: 401, headers: cors(origin) });
    const token = authz.slice("Bearer ".length);
    const { data: u } = await supabase.auth.getUser(token);
    const userId = u?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "bad token" }), { status: 401, headers: cors(origin) });

    const body = (await req.json()) as SaveBody;
    const exchange = body.exchange;
    if (!["binance","bybit","okx"].includes(exchange)) {
      return new Response(JSON.stringify({ error: "bad exchange" }), { status: 400, headers: cors(origin) });
    }
    if (!body.api_key || !body.api_secret) {
      return new Response(JSON.stringify({ error: "missing api key/secret" }), { status: 400, headers: cors(origin) });
    }
    if (exchange === "okx" && !body.api_passphrase) {
      return new Response(JSON.stringify({ error: "okx requires api_passphrase" }), { status: 400, headers: cors(origin) });
    }

    const enc_blob = await encryptJson({
      apiKey: body.api_key,
      apiSecret: body.api_secret,
      apiPassphrase: body.api_passphrase ?? null,
    });

    // credentials upsert
    const { error: e1 } = await supabase
      .from("exchange_api_credentials")
      .upsert({
        user_id: userId,
        exchange,
        external_user_id: body.external_user_id ?? null,
        enc_blob,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,exchange" });
    if (e1) return new Response(JSON.stringify({ ok: false, error: e1.message }), { status: 500, headers: cors(origin) });

    // connection upsert (status: linked_keys)
    const { error: e2 } = await supabase
      .from("exchange_connections")
      .upsert({
        user_id: userId,
        exchange,
        external_user_id: body.external_user_id ?? null,
        status: "linked_keys",
      }, { onConflict: "user_id,exchange" });
    if (e2) return new Response(JSON.stringify({ ok: false, error: e2.message }), { status: 500, headers: cors(origin) });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors(origin) });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: cors(origin) });
  }
});
