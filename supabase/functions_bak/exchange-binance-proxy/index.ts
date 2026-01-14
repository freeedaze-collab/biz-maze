// supabase/functions/exchange-binance-proxy/index.ts
// Deno Edge Function (Dashboardでそのままデプロイ可)
// - CORS対応
// - 認証（Authorization: Bearer <access_token>）
// - action: "link" … exchange_connections に upsert（ダミーでまずは通す）
// - action: "sign" … Binance用の HMAC-SHA256 署名（WebCryptoで実装）

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "GET,POST,OPTIONS",
});

// ---- HMAC-SHA256 (HEX) using WebCrypto ----
async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  const bytes = new Uint8Array(sig);
  // to hex
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16).padStart(2, "0");
    hex += h;
  }
  return hex;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(origin), status: 200 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (req.method === "GET") {
      return new Response(JSON.stringify({ ok: true, service: "binance-proxy" }), {
        headers: { "content-type": "application/json", ...cors(origin) },
        status: 200,
      });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { headers: cors(origin), status: 405 });
    }

    // 認証
    let userId: string | null = null;
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (authz?.startsWith("Bearer ")) {
      const accessToken = authz.slice("Bearer ".length);
      const { data: userRes } = await supabase.auth.getUser(accessToken);
      userId = userRes?.user?.id ?? null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        headers: { "content-type": "application/json", ...cors(origin) },
        status: 401,
      });
    }

    // 本文
    const body = (await req.json().catch(() => ({}))) as Json;
    const action = String(body?.action ?? "link");

    // 1) Link（まずは通す土台）
    if (action === "link") {
      const exchange = String(body?.exchange ?? "binance");
      const external_user_id = (body?.external_user_id ?? null) as string | null;

      const { error } = await supabase
        .from("exchange_connections")
        .upsert(
          {
            user_id: userId,
            exchange,
            external_user_id,
            status: "linked",
          },
          { onConflict: "user_id,exchange" },
        );

      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          headers: { "content-type": "application/json", ...cors(origin) },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json", ...cors(origin) },
        status: 200,
      });
    }

    // 2) Sign（将来: Binance 署名テスト用）
    //   body: { action: "sign", secret: "...", query: "recvWindow=5000&timestamp=..." }
    if (action === "sign") {
      const secret = String(body?.secret ?? "");
      const query = String(body?.query ?? "");
      if (!secret || !query) {
        return new Response(JSON.stringify({ ok: false, error: "secret and query required" }), {
          headers: { "content-type": "application/json", ...cors(origin) },
          status: 400,
        });
      }
      const signature = await hmacSha256Hex(secret, query);
      return new Response(JSON.stringify({ ok: true, signature }), {
        headers: { "content-type": "application/json", ...cors(origin) },
        status: 200,
      });
    }

    // 未対応
    return new Response(JSON.stringify({ ok: false, error: "Unsupported action" }), {
      headers: { "content-type": "application/json", ...cors(origin) },
      status: 400,
    });
  } catch (e) {
    console.error("[exchange-binance-proxy] error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      headers: { "content-type": "application/json", ...cors(origin) },
      status: 500,
    });
  }
});
