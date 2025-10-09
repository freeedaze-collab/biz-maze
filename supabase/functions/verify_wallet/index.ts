// supabase/functions/verify-wallet-signature/index.ts
// 署名方式を EIP-712 Typed Data に統一。
// GET  : 署名用 nonce を返却
// POST : { address, nonce, signature } を verifyTypedData で検証し、OKなら wallets を upsert

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
import { verifyTypedData } from "https://esm.sh/viem@2.21.15";

type JwtUser = { sub: string };

const CORS_ALLOW_HEADERS = "authorization, content-type";

const domain = {
  name: "BizMaze",
  version: "1",
  // chainId は省略（Preview/本番でズレやすいため）
  // verifyingContract も今回は不要
} as const;

const types = {
  WalletLink: [
    { name: "wallet", type: "address" },
    { name: "nonce",  type: "string"  },
  ],
} as const;

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
  };
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  const headers = corsHeaders(req);

  // 認証（JWT）
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing bearer token" }), {
      status: 401, headers: { ...headers, "content-type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: u, error: uerr } = await supabase.auth.getUser(jwt);
  if (uerr || !u?.user) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401, headers: { ...headers, "content-type": "application/json" },
    });
  }
  const userId = (u.user as unknown as JwtUser).sub;

  if (req.method === "GET") {
    const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    return new Response(JSON.stringify({ nonce }), {
      status: 200, headers: { ...headers, "content-type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const address: string = body.address ?? "";
    const signature: string = body.signature ?? "";
    const nonce: string = body.nonce ?? "";

    if (!address || !signature || !nonce) {
      return new Response(JSON.stringify({ error: "Missing address/signature/nonce" }), {
        status: 400, headers: { ...headers, "content-type": "application/json" },
      });
    }

    // EIP-712 検証
    const ok = await verifyTypedData({
      address: address as `0x${string}`,
      domain,
      types,
      primaryType: "WalletLink",
      message: { wallet: address, nonce },
      signature: signature as `0x${string}`,
    }).catch(() => false);

    if (!ok) {
      return new Response(JSON.stringify({ error: "Signature does not match the address" }), {
        status: 400, headers: { ...headers, "content-type": "application/json" },
      });
    }

    // 保存（user_id + address のユニークで upsert）
    const { error: upErr } = await supabase
      .from("wallets")
      .upsert(
        { user_id: userId, address: address.toLowerCase(), verified: true },
        { onConflict: "user_id,address" },
      );

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...headers, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...headers, "content-type": "application/json" },
    });
  }

  return new Response("Not Found", { status: 404, headers });
});
