// supabase/functions/verify-wallet-signature/index.ts
// 署名→アドレス復元→本人一致→DB upsert（wallets）
// CORS & OPTIONS 対応 / invoke(POST) の action=nonce,verify を両方許容
// 「B（過去成功版）」の流儀を踏襲：viem の hashMessage/recoverAddress を使用

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // 必要あれば preview--*.lovable.app に絞ってください
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function nonce() {
  // UUIDでも十分。B版に合わせて12〜32桁程度のランダム文字列でもOK
  const n = crypto.randomUUID().replace(/-/g, "");
  return n;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 認証ユーザーを取りたい場合（verify_jwt=true の時に有効）
    const supabaseWithAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!, // 認証ヘッダーだけ使う
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") || "",
          },
        },
      }
    );

    if (req.method === "GET") {
      // GETでもノンス払い出しOKにしておく（保険）
      return json({ nonce: nonce() });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let payload: any = {};
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      payload = await req.json().catch(() => ({}));
    }

    const action = String(payload?.action || "");
    if (action === "nonce") {
      return json({ nonce: nonce() });
    }

    if (action !== "verify") {
      return json({ error: "Invalid action" }, 400);
    }

    const address: string = payload?.address;
    const signature: string = payload?.signature;
    const n: string = payload?.nonce;

    if (!isAddress(address) || typeof signature !== "string" || typeof n !== "string") {
      return json({ error: "Bad request: invalid address/signature/nonce" }, 400);
    }

    // EIP-191 前置きを含めたハッシュで復元（B版と同じやり方）
    const recovered = await recoverAddress({
      hash: hashMessage(n),
      signature,
    });

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return json({ error: "Signature does not match the address", recovered, address }, 400);
    }

    // 呼び出し元の認証ユーザー
    const { data: userRes } = await supabaseWithAuth.auth.getUser();
    const user_id = userRes?.user?.id;
    if (!user_id) {
      // verify_jwt=false でも通るようにするなら、別途 user_id を body に載せる運用でも良いが、
      // セキュアに行くなら verify_jwt=true を推奨
      return json({ error: "Unauthorized: missing user" }, 401);
    }

    // DB upsert（wallets テーブル： user_id / address / verified / created_at）
    // ※ network カラムが無い環境で 42703 が出ていたため、ここでは address/verified のみ保存
    const { error: upsertErr } = await supabaseAdmin
      .from("wallets")
      .upsert(
        { user_id, address: address.toLowerCase(), verified: true },
        { onConflict: "user_id,address" }
      );

    if (upsertErr) {
      return json({ error: "DB upsert failed", details: upsertErr }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("[verify-wallet-signature] fatal:", e);
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
