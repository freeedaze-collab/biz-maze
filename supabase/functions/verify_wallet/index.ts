// supabase/functions/verify_wallet/index.ts
// Deno Edge Function（Node ではありません）
// GET  : { nonce, signText } を返す
// POST : { address, signature, nonce } を受け取り、同じ nonce で signText を再構成して検証
// 成功なら profiles.primary_wallet を更新（必要に応じて wallets へも保存可能）

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage, getAddress } from "npm:ethers@6";

const cors = {
  "access-control-allow-origin": "*", // 必要に応じて本番ドメインに絞ってください
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

function randHex(len = 32) {
  const arr = new Uint8Array(len / 2);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
}

// 署名メッセージを“必ず同じ形”で作る。不要な trim / 改行変更は厳禁。
function buildSignText(nonce: string) {
  return `BizMaze Wallet Verification

Nonce: ${nonce}

Sign this message to prove you control the wallet.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // Auth ヘッダ必須（Verify JWT with legacy secret / Verify JWT のいずれかを利用）
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401,
      headers: { "content-type": "application/json", ...cors },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey, { global: { headers: { Authorization: `Bearer ${token}` } } });

  // 認証ユーザーを取得
  const { data: userRes } = await supabase.auth.getUser(token);
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid auth" }), {
      status: 401,
      headers: { "content-type": "application/json", ...cors },
    });
  }

  // デバッグフラグ
  const dbg = /dbg=1/.test(new URL(req.url).search);

  if (req.method === "GET") {
    const nonce = randHex(32);
    const signText = buildSignText(nonce);
    return new Response(JSON.stringify({ nonce, signText }), {
      headers: { "content-type": "application/json", ...cors },
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const inputAddr: string = String(body.address || "");
    const signature: string = String(body.signature || "");
    const nonce: string = String(body.nonce || ""); // ★ クライアントから受け取る

    if (!/^0x[a-fA-F0-9]{40}$/.test(inputAddr)) {
      return new Response(JSON.stringify({ error: "Invalid address" }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      });
    }
    if (!signature || !nonce) {
      return new Response(JSON.stringify({ error: "Missing signature or nonce" }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      });
    }

    // GET 時と同じルールで signText を再構成（＝nonce が一致していれば同一メッセージ）
    const signText = buildSignText(nonce);

    let recovered = "";
    try {
      recovered = getAddress(verifyMessage(signText, signature)); // チェックサム化
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid signature format", dbg: String(e) }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      });
    }

    const inputChecksum = getAddress(inputAddr);
    if (recovered.toLowerCase() !== inputChecksum.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Signature does not match the address", dbg: { input: inputChecksum, recovered } }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      });
    }

    // OK: 任意の保存処理
    await supabase
      .from("profiles")
      .update({ primary_wallet: inputChecksum })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ ok: true, recovered, user_id: user.id, dbg: dbg ? { signText } : undefined }), {
      headers: { "content-type": "application/json", ...cors },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "content-type": "application/json", ...cors },
  });
});
