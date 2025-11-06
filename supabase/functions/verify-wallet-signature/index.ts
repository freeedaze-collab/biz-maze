// Deno runtime for Supabase Edge Functions
// File: supabase/functions/verify-wallet-signature/index.ts

// --- imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAddress,
  hashMessage,        // <- EIP-191 前置きを含むハッシュ化
  recoverAddress,     // <- 署名からアドレス復元
} from "https://esm.sh/viem@2";

// --- env
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// --- init
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// --- helpers
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // CORS
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return json({}, 204);

  // 認証（JWT 必須。UI 側は Authorization: Bearer を付ける）
  const auth = req.headers.get("authorization") ?? "";
  const jwt  = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7)
    : undefined;

  // GET: ノンス発行
  if (req.method === "GET") {
    if (!jwt) return json({ error: "Unauthorized" }, 401);
    const nonce = crypto.randomUUID().replace(/-/g, "");
    return json({ nonce }, 200);
  }

  // POST: 検証
  if (req.method === "POST") {
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }

    const { action } = body ?? {};

    if (action === "nonce") {
      // invoke(body={action:'nonce'}) 用の互換ハンドラ
      const nonce = crypto.randomUUID().replace(/-/g, "");
      return json({ nonce }, 200);
    }

    if (action === "verify") {
      const address   = String(body?.address ?? "");
      const signature = String(body?.signature ?? "");
      const nonce     = String(body?.nonce ?? "");

      // 入力バリデーション
      if (!isAddress(address) || !signature || !nonce) {
        return json({ error: "Bad request" }, 400);
      }

      // ここが最重要：nonce を**そのまま** hashMessage へ
      // JSON.stringify したり、trim したり、改行を足したりしない
      const hash = hashMessage(nonce);

      let recovered = "";
      try {
        recovered = await recoverAddress({ hash, signature });
      } catch (e) {
        return json({ error: "Invalid signature", detail: String(e) }, 400);
      }

      // 大文字小文字を無視して比較
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        // デバッグ用の最小限ログ（Supabase Logsで確認可能）
        console.log("sig-mismatch", {
          input: address,
          recovered,
          nonce8: nonce.slice(0, 8),
          sigLen: signature.length,
        });
        return json(
          { error: "Signature mismatch", recovered, address },
          400,
        );
      }

      // ここで wallets へ upsert（必要な場合のみ）
      // await admin.from('wallets').upsert(
      //   { user_id: (await admin.auth.getUser(jwt)).data.user?.id, address, verified: true },
      //   { onConflict: 'user_id,address' },
      // );

      return json({ ok: true }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  }

  return json({ error: "Method not allowed" }, 405);
});
