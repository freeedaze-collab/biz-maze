// supabase/functions/verify-wallet-signature/index.ts
// サーバ側：クライアントが sign した “同一プレーン文字列” を verifyMessage で検証
// GET  : 署名用 nonce を返す
// POST : { address, nonce, signature } を検証し、OKなら wallets に upsert

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
import { verifyMessage } from "https://esm.sh/viem@2.21.15";

type JwtUser = { sub: string };

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
}

function makeMessage(nonce: string) {
  // ★ クライアントと完全一致させる
  return `Link wallet by signing this nonce: ${nonce}`;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  const headers = corsHeaders(req);

  // 認証チェック
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing bearer token" }), {
      status: 401,
      headers: { ...headers, "content-type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ユーザIDを取得
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401,
      headers: { ...headers, "content-type": "application/json" },
    });
  }
  const userId = (userData.user as unknown as JwtUser).sub;

  if (req.method === "GET") {
    // 署名用 nonce を返すだけ（DB保存はせず、クライアントがそのままPOSTに同梱）
    const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    return new Response(JSON.stringify({ nonce }), {
      status: 200,
      headers: { ...headers, "content-type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const address: string = body.address ?? "";
    const signature: string = body.signature ?? "";
    const nonce: string = body.nonce ?? "";

    if (!address || !signature || !nonce) {
      return new Response(JSON.stringify({ error: "Missing address/signature/nonce" }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    // メッセージをクライアントと“完全同一”に組み立て
    const message = makeMessage(nonce);

    // 署名検証
    const ok = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    }).catch(() => false);

    if (!ok) {
      // デバッグ用に recovered を返さない（セキュリティ上は不要情報）
      return new Response(JSON.stringify({ error: "Signature does not match the address" }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    // DB へ upsert（wallets：user_id + address のユニーク）
    const { error: upErr } = await supabase
      .from("wallets")
      .upsert(
        { user_id: userId, address: address.toLowerCase(), verified: true },
        { onConflict: "user_id,address" },
      );

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...headers, "content-type": "application/json" },
    });
  }

  return new Response("Not Found", { status: 404, headers });
});
