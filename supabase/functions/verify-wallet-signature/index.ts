// supabase/functions/verify-wallet-signature/index.ts
// Deno.serve 版：CORS/エラー本文も返す堅牢実装

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

const ALLOW_ORIGIN = "*"; // 必要なら preview--*.lovable.app に絞る

function json(body: unknown, init: number | ResponseInit = 200): Response {
  const status = typeof init === "number" ? init : init.status ?? 200;
  const headers = new Headers(
    typeof init === "number" ? {} : init.headers ?? {},
  );
  headers.set("content-type", "application/json");
  headers.set("access-control-allow-origin", ALLOW_ORIGIN);
  headers.set(
    "access-control-allow-headers",
    "authorization, content-type, x-client-info, apikey",
  );
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return json({ error: "Content-Type must be application/json" }, 415);
    }

    const body = await req.json().catch(() => null) as any;
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);

    const action = body.action;

    if (action === "nonce") {
      const nonce = crypto.randomUUID().replace(/-/g, "");
      return json({ nonce });
    }

    if (action === "verify") {
      const address: string = body.address;
      const signature: string = body.signature;
      const nonce: string = body.nonce;

      if (!isAddress(address) || typeof signature !== "string" || typeof nonce !== "string") {
        return json({ error: "Bad request: address/signature/nonce invalid" }, 400);
      }

      try {
        const recovered = await recoverAddress({ hash: hashMessage(nonce), signature });
        if (recovered.toLowerCase() !== address.toLowerCase()) {
          return json(
            { error: "Signature does not match the address", input: address, recovered },
            400,
          );
        }
      } catch (e) {
        return json({ error: "Recover failed", detail: String(e) }, 400);
      }

      // 必要ならここで wallets に upsert する（今回は verify OK のみ返却）
      return json({ ok: true });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (e) {
    return json({ error: "Internal error", detail: String(e) }, 500);
  }
});
