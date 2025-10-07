// Supabase Edge Function (Deno)
// GET  : Nonce を発行して profiles.verify_nonce に保存
// POST : 署名検証して OK なら profiles.primary_wallet を更新（verify_nonce は消す）

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "npm:ethers@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ETH_RPC_URL = Deno.env.get("ETH_RPC_URL") || ""; // 任意

function J(body: unknown, init: number | ResponseInit = 200) {
  const resInit = typeof init === "number" ? { status: init } : init;
  return new Response(JSON.stringify(body), {
    ...resInit,
    headers: { "content-type": "application/json", ...(resInit as ResponseInit).headers },
  });
}

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");

serve(async (req) => {
  // Authorization: Bearer <access_token> を信頼してユーザー文脈で動く
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return J({ ok: false, error: "Unauthorized" }, 401);
  const userId = auth.user.id;

  try {
    if (req.method === "GET") {
      const nonce = crypto.randomUUID();
      const { error } = await supabase
        .from("profiles")
        .update({ verify_nonce: nonce })
        .eq("user_id", userId);
      if (error) return J({ ok: false, error: "Failed to store nonce" }, 500);
      return J({ ok: true, nonce });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const address = (body.address || "").trim();
      const signature = (body.signature || "").trim();
      if (!isEthAddress(address)) return J({ ok: false, error: "Invalid address format" }, 400);
      if (!signature) return J({ ok: false, error: "Missing signature" }, 400);

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("verify_nonce")
        .eq("user_id", userId)
        .single();
      if (error) return J({ ok: false, error: "Profile not found" }, 404);
      const nonce = prof?.verify_nonce;
      if (!nonce) return J({ ok: false, error: "Nonce not found. Call GET first." }, 400);

      // 署名検証（EIP-191）
      let recovered = "";
      try {
        recovered = ethers.verifyMessage(nonce, signature);
      } catch {
        return J({ ok: false, error: "Signature verification failed" }, 400);
      }
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return J({ ok: false, error: "Signature does not match address" }, 400);
      }

      // 任意の追加確認（RPCに触る場合）
      if (ETH_RPC_URL) {
        try {
          const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
          await provider.getNetwork(); // 接続疎通（失敗しても機能は継続）
        } catch { /* ignore */ }
      }

      const { error: upErr } = await supabase
        .from("profiles")
        .update({ primary_wallet: address, verify_nonce: null })
        .eq("user_id", userId);
      if (upErr) return J({ ok: false, error: "Failed to save wallet" }, 500);

      return J({ ok: true, address });
    }

    return J({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return J({ ok: false, error: `Unhandled: ${e?.message ?? e}` }, 500);
  }
});
