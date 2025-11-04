// supabase/functions/verify-wallet-signature/index.ts
// Deno Deploy / Supabase Edge Functions
// - CORSを明示
// - action: "nonce" / "verify"
// - EIP-191に合わせて server側は hashMessage(nonce) で recover
// - 失敗時の本文を詳細に返す（フロントの alert に出る）

import { serve } from "jsr:@supabase/functions-js/edge-runtime";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

const ALLOW_ORIGIN = "*"; // 必要なら preview--*.lovable.app 等に絞る

function json(
  body: unknown,
  init: number | ResponseInit = 200,
): Response {
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

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    const method = req.method;

    if (method === "POST") {
      if (!contentType.includes("application/json")) {
        return json(
          { error: "Content-Type must be application/json" },
          415,
        );
      }
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const action = (body as any).action;
      if (action === "nonce") {
        const nonce = crypto.randomUUID().replace(/-/g, "");
        return json({ nonce }); // { nonce: "..." }
      }

      if (action === "verify") {
        const address = (body as any).address;
        const signature = (body as any).signature;
        const nonce = (body as any).nonce;

        if (
          !isAddress(address) ||
          typeof signature !== "string" ||
          typeof nonce !== "string"
        ) {
          return json(
            { error: "Bad request: address/signature/nonce invalid" },
            400,
          );
        }

        // EIP-191: client は personal_sign(nonce) を使う前提
        const hash = hashMessage(nonce);
        let recovered: string;
        try {
          recovered = await recoverAddress({ hash, signature });
        } catch (e) {
          console.error("recoverAddress error:", e);
          return json(
            { error: "Recover failed", detail: String(e) },
            400,
          );
        }

        if (recovered.toLowerCase() !== address.toLowerCase()) {
          return json(
            {
              error: "Signature does not match the address",
              input: address,
              recovered,
            },
            400,
          );
        }

        // ここでDB upsert等が必要なら実施（今回は verify のみOK返す）
        return json({ ok: true, addr: address, recovered });
      }

      return json({ error: "Unsupported action" }, 400);
    }

    // GETで nonce を返す実装を使いたい場合（現状はPOST/nonceで統一）
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("Unhandled error:", e);
    return json({ error: "Internal error", detail: String(e) }, 500);
  }
});
