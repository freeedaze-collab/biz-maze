// supabase/functions/verify-wallet-signature/index.ts
// 署名ワークフロー：
// 1) { action: 'nonce' }        → プロファイルに nonce を保存して返す
// 2) { action: 'verify', address, signature, nonce }
//    → 署名検証OKなら wallets に upsert、profiles.verify_nonce をクリア

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // 動作優先。必要に応じて本番ドメインへ絞ってください
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const handleOptions = (req: Request) =>
  req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;

function jsonHeaders(extra: Record<string,string> = {}) {
  return { ...corsHeaders, "Content-Type": "application/json", ...extra };
}

function getSupabaseClientWithAuth(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

  // RLS を “呼び出しユーザーの権限” で通す
  return createClient(url, anon, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined);
}

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders() });
  }

  try {
    const supabase = getSupabaseClientWithAuth(req);
    const { data: userResp, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userResp?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders() });
    }
    const userId = userResp.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body?.action as "nonce" | "verify" | undefined;

    if (action === "nonce") {
      // 1) ノンス発行 → profiles.verify_nonce に保存
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ verify_nonce: nonce, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), { status: 400, headers: jsonHeaders() });
      }
      return new Response(JSON.stringify({ nonce }), { headers: jsonHeaders() });
    }

    if (action === "verify") {
      const address = String(body?.address ?? "");
      const signature = String(body?.signature ?? "");
      const nonce = String(body?.nonce ?? "");

      // 入力検証
      if (!isAddress(address) || !signature || !nonce) {
        return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: jsonHeaders() });
      }

      // DB から最新の nonce を取得
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("verify_nonce")
        .eq("id", userId)
        .single();
      if (pErr) {
        return new Response(JSON.stringify({ error: pErr.message }), { status: 400, headers: jsonHeaders() });
      }
      if (!prof?.verify_nonce || prof.verify_nonce !== nonce) {
        return new Response(JSON.stringify({ error: "Nonce mismatch/expired" }), { status: 400, headers: jsonHeaders() });
      }

      // EIP-191（personal_sign）方式で検証（整形しない）
      const recovered = await recoverAddress({ hash: hashMessage(nonce), signature });

      // 大文字小文字の揺れを吸収して比較
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        console.log("recover mismatch", { input: address, recovered });
        return new Response(JSON.stringify({ error: "Signature mismatch" }), { status: 400, headers: jsonHeaders() });
      }

      // wallets へ upsert（user_id+address unique を想定）
      const { error: wErr } = await supabase
        .from("wallets")
        .upsert({
          user_id: userId,
          address: address.toLowerCase(),
          verified_at: new Date().toISOString(),
        }, { onConflict: "user_id,address" });

      if (wErr) {
        return new Response(JSON.stringify({ error: wErr.message }), { status: 400, headers: jsonHeaders() });
      }

      // 使い終わった nonce をクリア
      await supabase.from("profiles").update({ verify_nonce: null }).eq("id", userId);

      return new Response(JSON.stringify({ ok: true, recovered }), { headers: jsonHeaders() });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: jsonHeaders() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders() });
  }
});
