// supabase/functions/verify-wallet-signature/index.ts
// Deno runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verifyMessage, getAddress } from "npm:viem";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

function corsHeaders(origin?: string): HeadersInit {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "content-type": "application/json; charset=utf-8",
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "*";
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  try {
    // auth (user is optional for GET, required for POST)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    });

    // ---------- GET: return message to sign (deterministic)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const addr = (url.searchParams.get("address") || "").toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(addr)) {
        return new Response(JSON.stringify({ error: "Invalid address" }), {
          status: 400,
          headers: corsHeaders(origin),
        });
      }
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id || "anonymous";

      const nonce = crypto.randomUUID().replace(/-/g, ""); // 32 hex
      const message =
        `BizMaze Wallet Linking\n` +
        `User: ${uid}\n` +
        `Address: ${addr}\n` +
        `Nonce: ${nonce}\n` +
        `Timestamp: ${Date.now()}`;

      return new Response(JSON.stringify({ message }), { headers: corsHeaders(origin) });
    }

    // ---------- POST: verify signed message
    if (req.method === "POST") {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders(origin),
        });
      }

      const { address, signature, message } = (await req.json().catch(() => ({}))) as {
        address?: string;
        signature?: `0x${string}`;
        message?: string;
      };

      if (!address || !signature || !message) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: corsHeaders(origin),
        });
      }

      // Normalize to checksum
      const inputChecksum = getAddress(address);

      // viem の verifyMessage は boolean を返す（EIP-191 Prefix含め内部でよしなにやってくれます）
      const ok = await verifyMessage({
        address: inputChecksum,
        message,
        signature,
      });

      if (!ok) {
        return new Response(JSON.stringify({ ok: false, error: "Signature does not match the address" }), {
          status: 400,
          headers: corsHeaders(origin),
        });
      }

      // ここで DB 保存（profiles.primary_wallet でも wallets テーブルでも可）
      // 例: profiles.primary_wallet を更新
      const update = await supabase
        .from("profiles")
        .update({ primary_wallet: inputChecksum })
        .eq("user_id", uid);
      if (update.error) {
        return new Response(JSON.stringify({ ok: false, error: update.error.message }), {
          status: 500,
          headers: corsHeaders(origin),
        });
      }

      return new Response(JSON.stringify({ ok: true, address: inputChecksum }), {
        headers: corsHeaders(origin),
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders(origin),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});
