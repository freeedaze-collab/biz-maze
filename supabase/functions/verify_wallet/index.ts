// Deno runtime (Supabase Edge Functions)
// Verify wallet ownership via EIP-191 message signing
// GET  : issues a nonce and stores it in profiles.verify_nonce
// POST : verifies signature and, if valid, sets profiles.primary_wallet = address

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "npm:ethers@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ETH_RPC_URL = Deno.env.get("ETH_RPC_URL") || ""; // 任意: 追加検証用

function json(body: unknown, init: number | ResponseInit = 200) {
  const resInit = typeof init === "number" ? { status: init } : init;
  return new Response(JSON.stringify(body), {
    ...resInit,
    headers: { "content-type": "application/json", ...(resInit as ResponseInit).headers },
  });
}

function bad(msg: string, code = 400) {
  return json({ ok: false, error: msg }, code);
}

function isEthAddress(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

serve(async (req) => {
  // Supabase client with user context from Authorization header
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return bad("Unauthorized", 401);
  const userId = auth.user.id;

  const url = new URL(req.url);
  const method = req.method.toUpperCase();

  try {
    if (method === "GET") {
      // 1) Nonce を発行し、profiles.verify_nonce に保存
      const nonce = crypto.randomUUID();
      const { error } = await supabase
        .from("profiles")
        .update({ verify_nonce: nonce })
        .eq("user_id", userId);
      if (error) return bad("Failed to store nonce");

      return json({ ok: true, nonce });
    }

    if (method === "POST") {
      const body = await req.json().catch(() => ({}));
      const address = (body.address || "").trim();
      const signature = (body.signature || "").trim();

      if (!isEthAddress(address)) return bad("Invalid address format");
      if (!signature) return bad("Missing signature");

      // 2) 事前に発行した nonce を取得
      const { data: prof, error: selErr } = await supabase
        .from("profiles")
        .select("verify_nonce")
        .eq("user_id", userId)
        .single();
      if (selErr) return bad("Profile not found");

      const nonce: string | null = prof?.verify_nonce ?? null;
      if (!nonce) return bad("Nonce not found. Call GET first.");

      // 3) 署名検証（EIP-191）
      let recovered = "";
      try {
        recovered = ethers.verifyMessage(nonce, signature);
      } catch {
        return bad("Signature verification failed");
      }
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return bad("Signature does not match address");
      }

      // 4) 任意の追加検証：RPC でアドレスの形を軽く確認
      //    コントラクトでないことを必須にする場合は非推奨（EOA=code '0x' なので、必ず '0x' になります）
      if (ETH_RPC_URL) {
        try {
          const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
          const code = await provider.getCode(address);
          // ここで特別な判定は行わない（EOAは '0x'、コントラクトは '0x...'）
          // 必要ならブラックリストやチェーンID確認を追加
        } catch {
          // RPC接続に失敗した場合でも、署名で本人性は担保されているためブロックはしない
        }
      }

      // 5) 検証成功 → primary_wallet 設定 ＋ nonce クリア
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ primary_wallet: address, verify_nonce: null })
        .eq("user_id", userId);
      if (upErr) return bad("Failed to save wallet address");

      return json({ ok: true, address });
    }

    return bad("Method not allowed", 405);
  } catch (e) {
    return bad(`Unhandled error: ${e?.message ?? e}`, 500);
  }
});
