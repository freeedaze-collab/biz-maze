// supabase/functions/verify-wallet-signature/index.ts
// Deno (Supabase Edge Runtime)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * JSON レスポンス（デバッグ時にテキストではなく JSON を返す）
 */
function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  const h = new Headers({
    "content-type": "application/json",
    // 将来 browser fetch でも困らないように薄い CORS を付与
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    ...extraHeaders,
  });
  return new Response(JSON.stringify(body), { status, headers: h });
}

Deno.serve(async (req) => {
  // Preflight にも 204 を返しておく（invoke には不要だが将来の直接 fetch 用）
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
        "access-control-allow-methods": "POST,OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(payload?.action ?? "");
  // invoke の時は Verify JWT を OFF にしていても自前で認証をかける
  // （ON のままでも動きますが、設定ずれによる 401/400 を避けるため）
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  // セッションのユーザーを取得（Authorization: Bearer <access_token> が必須）
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return json({ error: "Unauthorized (missing/invalid Authorization)" }, 401);
  }
  const user = userRes.user;

  // action: 'nonce' | 'verify'
  if (action === "nonce") {
    // 前後の空白や改行でズレないように UUID 文字列のみ返す
    const nonce = crypto.randomUUID().replace(/-/g, "");
    return json({ nonce }, 200);
  }

  if (action === "verify") {
    const address: string = payload?.address ?? "";
    const signature: string = payload?.signature ?? "";
    const nonce: string = payload?.nonce ?? "";

    if (!isAddress(address) || typeof signature !== "string" || typeof nonce !== "string") {
      return json({ error: "Bad request (address/signature/nonce)" }, 400);
    }

    // EIP-191（personal_sign）前提：nonce をそのままハッシュして recover
    const recovered = await recoverAddress({
      hash: hashMessage(nonce),
      signature,
    });

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return json(
        { error: "Signature does not match the address", recovered, address },
        400
      );
    }

    // DB upsert（ユーザー毎に同じ address を一意にしたい場合は unique 制約を用意）
    const { error: upErr } = await supabase
      .from("wallets")
      .upsert(
        {
          user_id: user.id,
          address: address,
          verified: true,
          // created_at は DEFAULT now()
        },
        { onConflict: "user_id,address" }
      );

    if (upErr) {
      return json({ error: "DB upsert failed", details: upErr.message }, 400);
    }
    return json({ ok: true }, 200);
  }

  // 未知 action
  return json({ error: "Unknown action" }, 400);
});
