// supabase/functions/verify-wallet-signature/index.ts
// Deno Edge Function
import "jsr:@supabase/functions-js/edge-runtime"; // 新ランタイム
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, recoverMessageAddress } from "https://esm.sh/viem@2";

const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "GET,POST,OPTIONS",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  // CORS preflight
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
      // 文字列 nonce を返す（サーバでは保存しない / リプレイは UI で防ぐ）
      const nonce = crypto.randomUUID().replace(/-/g, "");
      return new Response(JSON.stringify({ nonce }), {
        headers: { "content-type": "application/json", ...cors(origin) },
        status: 200,
      });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        headers: cors(origin),
        status: 405,
      });
    }

    // 認証（任意）：Authorization が来ていればユーザを取り出す
    let userId: string | null = null;
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (authz?.startsWith("Bearer ")) {
      const accessToken = authz.slice("Bearer ".length);
      const { data: userRes } = await supabase.auth.getUser(accessToken);
      userId = userRes?.user?.id ?? null;
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action !== "verify") {
      return new Response(JSON.stringify({ error: "Unsupported action" }), {
        headers: { "content-type": "application/json", ...cors(origin) },
        status: 400,
      });
    }

    const address: string = body?.address;
    const signature: string = body?.signature;
    const message: string = body?.message;

    if (!isAddress(address) || typeof signature !== "string" || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Bad request" }), {
        headers: { "content-type": "application/json", ...cors(origin) },
        status: 400,
      });
    }

    // 署名検証（“同じ message 文字列”で復元）
    const recovered = await recoverMessageAddress({ message, signature });

    // デバッグログ（本番では削ってOK）
    console.info(
      `verify {\n  input: "${address}",\n  recovered: "${recovered}",\n  msg8: "${message.slice(0, 8)}",\n  sigLen: ${signature.length}\n}\n`
    );

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return new Response(
        JSON.stringify({ ok: false, error: "Signature mismatch", recovered }),
        {
          headers: { "content-type": "application/json", ...cors(origin) },
          status: 400,
        }
      );
    }

    // DB upsert（userId が取れている場合のみ そのユーザに紐付ける）
    if (userId) {
      const { error } = await supabase
        .from("wallets")
        .upsert(
          {
            user_id: userId,
            address: address.toLowerCase(),
            verified: true,
          },
          { onConflict: "user_id,address" } // 既存なら更新
        );
      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          headers: { "content-type": "application/json", ...cors(origin) },
          status: 500,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", ...cors(origin) },
      status: 200,
    });
  } catch (e) {
    console.error("verify-wallet-signature error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      headers: { "content-type": "application/json", ...cors(origin) },
      status: 500,
    });
  }
});
