// supabase/functions/verify-wallet-signature/index.ts
// 署名検証 → wallets へ upsert（user_id=auth.uid()）
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

type Ctx = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
};

function corsHeaders(origin?: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

// 認証（JWT）＋ Supabase client 構築
async function makeCtx(req: Request): Promise<Ctx> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!; // 読み取りには anon で十分
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  return { supabase, userId: user.id };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "*";

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  // ノンス発行
  if (req.method === "GET") {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    return new Response(JSON.stringify({ nonce }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405, headers: corsHeaders(origin),
    });
  }

  try {
    const { address, signature, nonce } = await req.json();

    // 入力バリデーション
    if (!isAddress(address) || typeof signature !== "string" || typeof nonce !== "string") {
      return new Response(JSON.stringify({ error: "Bad Request: invalid payload" }), {
        status: 400, headers: corsHeaders(origin),
      });
    }

    // 署名検証（EIP-191 / personal_sign）
    const recovered = await recoverAddress({
      hash: hashMessage(nonce), // 余計な整形をしない
      signature,
    });

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return new Response(JSON.stringify({
        error: "Signature does not match the address",
        recovered,
      }), { status: 400, headers: corsHeaders(origin) });
    }

    // 認証ユーザーを取得
    const { supabase, userId } = await makeCtx(req);

    // DB upsert（必要に応じて unique(user_id,address) を張る）
    const { error } = await supabase
      .from("wallets")
      .upsert(
        { user_id: userId, address: address.toLowerCase(), verified: true },
        { onConflict: "user_id,address" },
      );

    if (error) {
      console.error("DB upsert error:", error);
      return new Response(JSON.stringify({ error: "DB error", details: error.message }), {
        status: 500, headers: corsHeaders(origin),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e) {
    console.error("verify-wallet-signature fatal:", e);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500, headers: corsHeaders(origin),
    });
  }
});
