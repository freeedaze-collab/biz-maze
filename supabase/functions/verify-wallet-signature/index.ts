// supabase/functions/verify-wallet-signature/index.ts
// JWT必須 + 署名検証 + DB保存（wallets upsert）

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

const ALLOW_ORIGIN = "*"; // 必要なら preview--*.lovable.app に絞ってください

function json(body: unknown, init: number | ResponseInit = 200): Response {
  const status = typeof init === "number" ? init : init.status ?? 200;
  const headers = new Headers(typeof init === "number" ? {} : init.headers ?? {});
  headers.set("content-type", "application/json");
  headers.set("access-control-allow-origin", ALLOW_ORIGIN);
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "authorization, content-type, x-client-info, apikey");
  return new Response(JSON.stringify(body), { status, headers });
}

function base64urlToJson<T = any>(b64u: string): T {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, "="));
  return JSON.parse(json) as T;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return json({ ok: true });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // ---- JWT 必須（Supabase側で verify_jwt=true を有効化） ----
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const jwt = auth.slice("Bearer ".length);
    // Supabaseが署名検証済みなので、ここではpayloadだけ安全に取り出す
    let userId = "";
    try {
      const [, payloadB64u] = jwt.split(".");
      const payload = base64urlToJson<{ sub: string }>(payloadB64u);
      userId = payload?.sub || "";
    } catch {
      return json({ error: "Invalid JWT" }, 401);
    }
    if (!userId) return json({ error: "No user in token" }, 401);

    // ---- JSON body ----
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return json({ error: "Content-Type must be application/json" }, 415);

    const body = (await req.json().catch(() => null)) as any;
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);

    const action = body.action;

    if (action === "nonce") {
      // 署名用のランダムな文字列（改行/整形なし）
      return json({ nonce: crypto.randomUUID().replace(/-/g, "") });
    }

    if (action === "verify") {
      const address: string = body.address;
      const signature: string = body.signature;
      const nonce: string = body.nonce;

      if (!isAddress(address) || typeof signature !== "string" || typeof nonce !== "string") {
        return json({ error: "Bad request: address/signature/nonce invalid" }, 400);
      }

      // EIP-191: client は personal_sign(nonce) 前提
      let recovered = "";
      try {
        recovered = await recoverAddress({ hash: hashMessage(nonce), signature });
      } catch (e) {
        return json({ error: "Recover failed", detail: String(e) }, 400);
      }

      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return json({ error: "Signature does not match the address", input: address, recovered }, 400);
      }

      // ---- DB upsert (wallets) ----
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { error: upsertErr } = await supabaseAdmin
        .from("wallets")
        .upsert(
          {
            user_id: userId,
            address: address.toLowerCase(),
            verified_at: new Date().toISOString(),
          },
          { onConflict: "user_id,address" },
        );

      if (upsertErr) {
        return json({ error: "DB upsert failed", detail: upsertErr.message }, 500);
      }

      return json({ ok: true, user_id: userId, address: address.toLowerCase() });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (e) {
    return json({ error: "Internal error", detail: String(e) }, 500);
  }
});
