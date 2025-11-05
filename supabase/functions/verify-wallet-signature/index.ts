// index.ts (Supabase Edge Function)
// CORS と 204/body エラーの是正、nonce/verify を安定化

// 型補完用（import だけでOK）
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAddress,
  hashMessage,
  recoverAddress,
} from "https://esm.sh/viem@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(body: unknown, init: number = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status: init,
    headers: { "Content-Type": "application/json", ...cors, ...extraHeaders },
  });
}

function bad(msg: string, code = 400) {
  return json({ error: msg }, code);
}

Deno.serve(async (req) => {
  try {
    // 1) CORS プリフライト
    if (req.method === "OPTIONS") {
      // 204 は body を持てない → body なしで返す
      return new Response(null, { status: 204, headers: cors });
    }

    // 2) Supabase admin client（ユーザーの JWT を検証するため）
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 3) Authorization から user を取り出す
    const authz = req.headers.get("Authorization") ?? "";
    const token = authz.startsWith("Bearer ") ? authz.slice(7) : undefined;
    if (!token) return bad("Missing Authorization header", 401);

    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return bad("Invalid token", 401);
    const userId = userRes.user.id;

    // 4) ルーティング（POST: { action }）
    if (req.method !== "POST") return bad("Method Not Allowed", 405);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON body");
    }

    const action = String(body?.action ?? "");
    if (action === "nonce") {
      // 5) nonce を返す（200 + JSON）
      const nonce = crypto.randomUUID().replace(/-/g, "");
      return json({ nonce }); // 200
    }

    if (action === "verify") {
      const address: string = body?.address;
      const signature: string = body?.signature;
      const nonce: string = body?.nonce;

      if (!isAddress(address)) return bad("Invalid address");
      if (typeof signature !== "string" || !signature) return bad("Missing signature");
      if (typeof nonce !== "string" || !nonce) return bad("Missing nonce");

      // 6) 署名復元（EIP-191）
      let recovered: `0x${string}`;
      try {
        const hash = hashMessage(nonce);
        recovered = await recoverAddress({ hash, signature });
      } catch (e) {
        console.log("recover error:", e);
        return bad("Recover failed");
      }

      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return bad("Signature does not match the address");
      }

      // 7) DB 登録
      const { error: upErr } = await admin
        .from("wallets")
        .upsert(
          { user_id: userId, address: address.toLowerCase(), verified: true },
          { onConflict: "user_id,address" },
        );

      if (upErr) {
        console.log("upsert error:", upErr);
        return bad("DB upsert failed", 500);
      }

      return json({ ok: true }); // 200 + JSON
    }

    return bad("Unknown action");
  } catch (e) {
    // ここで 500 に落としても必ず JSON body を付ける
    console.log("fatal:", e);
    return json({ error: "Internal Error", message: String(e?.message ?? e) }, 500);
  }
});
