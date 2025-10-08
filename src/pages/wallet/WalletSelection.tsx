// supabase/functions/verify_wallet/index.ts
// Verify JWT: ON
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 追加: CORSヘッダ対応（OPTIONS/プリフライトもOK）

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/ethers@6.13.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 必要に応じて本番ドメインへ限定してください（例: https://your.app）
const ALLOW_ORIGIN = "*";

function withCors(resp: Response) {
  const headers = new Headers(resp.headers);
  headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  headers.set("Access-Control-Allow-Headers", "authorization, content-type");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Vary", "Origin");
  return new Response(resp.body, { status: resp.status, headers });
}
function json(body: unknown, status = 200) {
  return withCors(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}
function bad(msg: string, status = 400) {
  return json({ error: msg }, status);
}

function randomNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    // プリフライト対応
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return bad("Missing Bearer token", 401);

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: userRes, error: ue } = await svc.auth.getUser(token);
    if (ue || !userRes?.user) return bad("Not authenticated", 401);
    const user = userRes.user;

    if (req.method === "GET") {
      // ノンス発行（10分有効）
      const nonce = randomNonce();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error } = await svc.from("wallet_nonces").upsert({
        user_id: user.id,
        nonce,
        expires_at: expires,
      });
      if (error) return bad(error.message, 500);

      return json({ nonce, hint: "Sign this nonce in MetaMask to verify ownership." });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null) as { address?: string; signature?: string } | null;
      const address = (body?.address || "").toLowerCase();
      const signature = body?.signature || "";
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return bad("Invalid address", 422);
      if (!signature) return bad("Missing signature", 422);

      const { data: n, error: ne } = await svc
        .from("wallet_nonces")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (ne || !n) return bad("Nonce not found", 400);
      if (new Date(n.expires_at).getTime() < Date.now()) return bad("Nonce expired", 400);

      // 署名から復元したアドレスと入力アドレスの一致検証
      let recovered: string;
      try {
        recovered = verifyMessage(n.nonce, signature).toLowerCase();
      } catch {
        return bad("Invalid signature", 400);
      }
      if (recovered !== address) return bad("Signature does not match the address", 400);

      // wallets に upsert（verified=true）
      const { error: we } = await svc.from("wallets").upsert(
        { user_id: user.id, address, verified: true },
        { onConflict: "user_id, address" },
      );
      if (we) return bad(we.message, 500);

      // profiles.primary_wallet が空ならコピー
      const { data: prof } = await svc
        .from("profiles")
        .select("primary_wallet")
        .eq("user_id", user.id)
        .single();
      if (!prof?.primary_wallet) {
        await svc.from("profiles")
          .update({ primary_wallet: address })
          .eq("user_id", user.id);
      }

      await svc.from("wallet_nonces").delete().eq("user_id", user.id);

      return json({ ok: true });
    }

    return bad("Method not allowed", 405);
  } catch (e) {
    return bad((e as Error).message || String(e), 500);
  }
});
