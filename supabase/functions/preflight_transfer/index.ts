// Supabase Edge Function (Deno)
// 目的: 送金前の安全チェック（フォーマット/桁/自分のアドレスか/残高 足りるか）
// POST { from, to, amountEth } を受け取り、OK なら { ok:true } を返す
// ※ 実際の送金はフロントの MetaMask で実行します

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "npm:ethers@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ETH_RPC_URL = Deno.env.get("ETH_RPC_URL") || ""; // 任意（無くても動きます）

function J(body: unknown, init: number | ResponseInit = 200) {
  const resInit = typeof init === "number" ? { status: init } : init;
  return new Response(JSON.stringify(body), {
    ...resInit,
    headers: { "content-type": "application/json", ...(resInit as ResponseInit).headers },
  });
}

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
const isPositiveNumber = (s: string) => /^(\d+)(\.\d{1,18})?$/.test(s || ""); // ETH 最大18桁の小数

serve(async (req) => {
  if (req.method !== "POST") return J({ ok: false, error: "Method not allowed" }, 405);

  // ユーザー認証（Authorization: Bearer <access_token> 必須）
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return J({ ok: false, error: "Unauthorized" }, 401);
  const userId = auth.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const from = (body.from || "").trim();
    const to = (body.to || "").trim();
    const amountEth = (body.amountEth || "").trim();

    if (!isEthAddress(from)) return J({ ok: false, error: "Invalid 'from' address." }, 400);
    if (!isEthAddress(to)) return J({ ok: false, error: "Invalid 'to' address." }, 400);
    if (!isPositiveNumber(amountEth)) return J({ ok: false, error: "Invalid amount format." }, 400);

    // profiles.primary_wallet が自分の from と一致していること（簡易オーナー確認）
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("primary_wallet")
      .eq("user_id", userId)
      .single();
    if (profErr) return J({ ok: false, error: "Profile not found." }, 404);
    if (!prof?.primary_wallet || prof.primary_wallet.toLowerCase() !== from.toLowerCase()) {
      return J({ ok: false, error: "Sender address is not your verified wallet." }, 400);
    }

    // 残高チェック（ETH_RPC_URL があれば）
    if (ETH_RPC_URL) {
      try {
        const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
        const bal = await provider.getBalance(from);
        const wei = ethers.parseUnits(amountEth, 18);
        if (bal < wei) return J({ ok: false, error: "Insufficient balance." }, 400);
      } catch {
        // RPCが無くても機能は継続
      }
    }

    return J({ ok: true });
  } catch (e) {
    return J({ ok: false, error: `Unhandled: ${e?.message ?? e}` }, 500);
  }
});
