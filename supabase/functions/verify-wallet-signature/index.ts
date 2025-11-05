// supabase/functions/verify-wallet-signature/index.ts
// --- 必要な型/関数だけ最小限に ---
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAddress,
  hashMessage,
  recoverAddress,
} from "https://esm.sh/viem@2";

// CORS 共通ヘッダ
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...headers },
  });
}

Deno.serve(async (req) => {
  try {
    // Preflight
    if (req.method === "OPTIONS") {
      // 204 は本当に「空レスポンス」にする（body なし）
      return new Response(null, { status: 204, headers: CORS });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // 認証（JWT）
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceRole, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: userRes, error: userErr } = await client.auth.getUser();
    if (userErr || !userRes?.user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userRes.user.id;

    // 入力
    let payload: any = null;
    try {
      payload = await req.json(); // POST のみで 1 回だけ読む
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const action = payload?.action;
    if (action === "nonce") {
      const nonce = crypto.randomUUID().replace(/-/g, "");
      // ここは 200 + JSON（204 は使わない）
      return json({ nonce }, 200);
    }

    if (action === "verify") {
      const address = payload?.address as string;
      const signature = payload?.signature as string;
      const nonce = payload?.nonce as string;

      if (!isAddress(address) || typeof signature !== "string" || typeof nonce !== "string") {
        return json({ error: "Bad request" }, 400);
      }

      // EIP-191 前置き込みハッシュで検証
      const recovered = await recoverAddress({ hash: hashMessage(nonce), signature });
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return json({ ok: false, error: "Signature does not match address" }, 400);
      }

      // DB 反映（wallets: id bigserial / user_id uuid / address text unique(user_id,address) 推奨）
      const { error: upsertErr } = await client
        .from("wallets")
        .upsert(
          { user_id: userId, address, verified: true },
          { onConflict: "user_id,address" }
        );
      if (upsertErr) {
        return json({ ok: false, error: upsertErr.message }, 500);
      }

      return json({ ok: true }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    // ここも必ず 500 + JSON
    return json({ error: "Internal Error", message: String(e?.message ?? e) }, 500);
  }
});
