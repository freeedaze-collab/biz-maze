// supabase/functions/verify_wallet/index.ts
// Verify JWT: ON（必須）
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY（必須）
// ポイント: CORSを明示 & 詳細ログを出して原因を確定しやすく

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/ethers@6.13.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOW_ORIGIN = "*"; // 必要に応じて本番ドメインへ絞ってください

function withCors(resp: Response) {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  h.set("Access-Control-Allow-Headers", "authorization, content-type");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Vary", "Origin");
  return new Response(resp.body, { status: resp.status, headers: h });
}
function json(body: unknown, status = 200) {
  return withCors(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}
function bad(msg: string, status = 400, extra?: Record<string, unknown>) {
  // クライアントには汎用メッセージ、詳細は Logs に出す
  if (extra) console.log("[verify_wallet] bad:", msg, extra);
  else console.log("[verify_wallet] bad:", msg);
  return json({ error: msg }, status);
}

function sanitizeAddr(v: string) {
  return (v || "").trim().toLowerCase();
}
function randomNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    const url = new URL(req.url);
    console.log("[verify_wallet] method:", req.method, "origin:", req.headers.get("origin"), "path:", url.pathname);

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return bad("Missing Bearer token", 401);

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: userRes, error: ue } = await svc.auth.getUser(token);
    if (ue || !userRes?.user) return bad("Not authenticated", 401, { ue });

    const user = userRes.user;
    console.log("[verify_wallet] user_id:", user.id);

    if (req.method === "GET") {
      const nonce = randomNonce();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await svc.from("wallet_nonces").upsert({
        user_id: user.id,
        nonce,
        expires_at: expires,
      });
      if (error) return bad("Failed to store nonce", 500, { error });

      console.log("[verify_wallet] issued nonce:", nonce, "expires_at:", expires);
      return json({ nonce, hint: "Sign this nonce in MetaMask." });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null) as { address?: string; signature?: string } | null;
      const rawInput = body?.address || "";
      const address = sanitizeAddr(rawInput);
      const signature = (body?.signature || "").trim();

      console.log("[verify_wallet] POST received:", {
        address_input: rawInput,
        address_sanitized: address,
        sig_len: signature.length,
      });

      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return bad("Invalid address", 422);
      if (!signature) return bad("Missing signature", 422);

      const { data: n, error: ne } = await svc
        .from("wallet_nonces")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (ne || !n) return bad("Nonce not found", 400, { ne });

      const expired = new Date(n.expires_at).getTime() < Date.now();
      if (expired) return bad("Nonce expired", 400, { expires_at: n.expires_at });

      let recovered = "";
      try {
        recovered = sanitizeAddr(verifyMessage(n.nonce, signature));
      } catch (e) {
        return bad("Invalid signature", 400, { e: String(e) });
      }

      console.log("[verify_wallet] compare addresses:", {
        recovered,
        input: address,
        match: recovered === address,
      });

      if (recovered !== address) {
        // ここでログに3点（入力/復元/一致判定）を出しているので原因が確定できます
        return bad("Signature does not match the address", 400);
      }

      const { error: we } = await svc.from("wallets").upsert(
        { user_id: user.id, address, verified: true },
        { onConflict: "user_id,address" },
      );
      if (we) return bad("Failed to upsert wallet", 500, { we });

      // 初回は profiles.primary_wallet に反映
      const { data: prof } = await svc
        .from("profiles")
        .select("primary_wallet")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!prof?.primary_wallet) {
        await svc.from("profiles")
          .update({ primary_wallet: address })
          .eq("user_id", user.id);
      }

      await svc.from("wallet_nonces").delete().eq("user_id", user.id);

      console.log("[verify_wallet] OK for user:", user.id, "address:", address);
      return json({ ok: true });
    }

    return bad("Method not allowed", 405);
  } catch (e) {
    console.error("[verify_wallet] fatal:", e);
    return bad((e as Error).message || String(e), 500);
  }
});
