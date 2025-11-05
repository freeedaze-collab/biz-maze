// supabase/functions/verify-wallet-signature/index.ts
// 常に JSON 返却し、返却直前のオブジェクトを console.log にも出力して
// Supabase Dashboard > Edge Functions > Logs で原因を観測できるようにする。

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAddress,
  hashMessage,
  recoverAddress,
} from "https://esm.sh/viem@2";

// --- util: JSON response + 直前ログ ---
function json(body: unknown, status = 200): Response {
  // 返す前にログへミラー
  console.log("verify-wallet-signature response", { status, body });
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, content-type, x-client-info, apikey",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    },
  });
}

Deno.serve(async (req: Request) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return json({ ok: true }, 204);
    }
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // Supabase client（フロントの Authorization を引き継ぐ）
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!; // verify_jwt=true でも Authorization を渡す
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    // 認証ユーザー確認
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return json(
        { error: "Unauthorized", details: authErr?.message ?? null },
        401
      );
    }
    const userId = authData.user.id;

    // 入力 JSON
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Bad JSON" }, 400);
    }

    const action = String(payload?.action ?? "");
    if (action === "nonce") {
      const nonce = crypto.randomUUID().replace(/-/g, "");
      return json({ nonce }, 200);
    }

    if (action === "verify") {
      const address = String(payload?.address ?? "");
      const signature = String(payload?.signature ?? "");
      const nonce = String(payload?.nonce ?? "");

      if (!isAddress(address) || !signature || !nonce) {
        return json(
          { error: "Bad request", hint: "address/signature/nonce required" },
          400
        );
      }

      // 署名検証（EIP-191）
      const recovered = await recoverAddress({
        hash: hashMessage(nonce),
        signature,
      });
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return json(
          {
            error: "Signature does not match the address",
            recovered,
            address,
          },
          400
        );
      }

      // DB 反映（wallets: id/ user_id/ address/ verified/ created_at）
      // 重複は許容（すでにあれば verified を true に更新）
      const { error: upsertErr } = await supabase
        .from("wallets")
        .upsert(
          {
            user_id: userId,
            address,
            verified: true,
          },
          { onConflict: "user_id,address" }
        );

      if (upsertErr) {
        return json(
          { error: "DB upsert failed", details: upsertErr.message },
          400
        );
      }

      return json({ ok: true }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    // 想定外
    console.error("verify-wallet-signature fatal", e);
    return json({ error: "Internal Error", message: String(e) }, 500);
  }
});
