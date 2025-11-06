// --- verify-wallet-signature (Edge Function / Deno) ---
// CORS を最優先で通し、GETでnonce発行、POSTで署名検証を行う実装

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

// 必須: CORS ヘッダ（プリフライトを 200 で返す）
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // 必要あれば origin を絞ってOK
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  // 1) プリフライト（OPTIONS）
  if (req.method === "OPTIONS") {
    // ここで 200 を返し、必ず CORS ヘッダを付与
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    // 2) ノンス発行（GET）
    if (req.method === "GET") {
      const nonce = crypto.randomUUID().replace(/-/g, "");
      return json({ nonce }); // 200
    }

    // 3) 署名検証（POST）
    if (req.method === "POST") {
      const { address, signature, nonce } = await req.json();

      if (!isAddress(address) || typeof signature !== "string" || typeof nonce !== "string") {
        return json({ error: "Bad request" }, 400);
      }

      // EIP-191（personal_sign）前提: メッセージ=nonce をそのまま hashMessage に渡す
      const recovered = await recoverAddress({
        hash: hashMessage(nonce),
        signature,
      });

      // 大文字小文字差吸収
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return json(
          { error: "Signature mismatch", recovered, address },
          400
        );
      }

      // TODO: 必要ならDB更新（wallets upsert 等）をここに
      return json({ ok: true }); // 200
    }

    // それ以外
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  } catch (e) {
    // 例外時も CORS ヘッダを忘れずに
    return json({ error: "Internal Error", message: String(e?.message ?? e) }, 500);
  }
});
