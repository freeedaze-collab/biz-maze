// supabase/functions/verify-wallet-signature/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function nonce() {
  return crypto.randomUUID().replace(/-/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ← Gateway では verify_jwt=false。ここで自前チェックを必須化
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization Bearer token" }, 401);
    }

    const supabaseWithAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    if (req.method === "GET") return json({ nonce: nonce() });

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    let body: any = {};
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      body = await req.json().catch(() => ({}));
    }

    const action = String(body?.action || "");
    if (action === "nonce") {
      return json({ nonce: nonce() });
    }

    if (action !== "verify") {
      return json({ error: "Invalid action" }, 400);
    }

    const address: string = body?.address;
    const signature: string = body?.signature;
    const n: string = body?.nonce;

    if (!isAddress(address) || typeof signature !== "string" || typeof n !== "string") {
      return json({ error: "Bad request: invalid address/signature/nonce" }, 400);
    }

    const recovered = await recoverAddress({ hash: hashMessage(n), signature });
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return json({ error: "Signature does not match the address", recovered, address }, 400);
    }

    // 呼出ユーザー（ここで確実に取れる）
    const { data: ures, error: uerr } = await supabaseWithAuth.auth.getUser();
    if (uerr || !ures?.user?.id) return json({ error: "Unauthorized user" }, 401);
    const user_id = ures.user.id;

    // wallets に upsert（network カラム無しでも安全）
    const { error: upsertErr } = await supabaseAdmin
      .from("wallets")
      .upsert({ user_id, address: address.toLowerCase(), verified: true }, { onConflict: "user_id,address" });

    if (upsertErr) return json({ error: "DB upsert failed", details: upsertErr }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("[verify-wallet-signature] fatal:", e);
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
