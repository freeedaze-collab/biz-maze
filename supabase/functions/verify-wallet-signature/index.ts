// supabase/functions/verify-wallet-signature/index.ts
// ─────────────────────────────────────────────────────────────
// A方式：MetaMask 互換の復元（@metamask/eth-sig-util の recoverPersonalSignature）
// ※ “nonce をそのまま”署名し、“そのまま”検証します（整形・JSON.stringify 等は一切しない）
// ─────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress } from "https://esm.sh/viem@2";
import {
  recoverPersonalSignature,
} from "npm:@metamask/eth-sig-util@7.0.1"; // Deno npm import

// CORS 共通ヘッダ
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // DB 書込が必要なら使用

serve(async (req: Request) => {
  // OPTIONS（プリフライト）
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // 1) GET: ノンス発行（ただの文字列）
  if (req.method === "GET") {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    return json({ nonce }, 200);
  }

  // 2) POST: 検証 → DB upsert
  if (req.method === "POST") {
    try {
      const { address, signature, nonce } = await req.json();

      // 入力チェック（“そのままの”値で）
      if (!isAddress(address) || typeof signature !== "string" || typeof nonce !== "string") {
        return json({ error: "Bad request" }, 400);
      }

      // MetaMask 互換のリカバー（メッセージは nonce そのまま）
      // data は「UTF-8文字列（16進や0x付でも可）」本文。MetaMask personal_sign と一致します。
      const recovered = recoverPersonalSignature({
        data: nonce,
        signature,
      });

      // 大文字小文字を無視して一致比較
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return json(
          {
            error: "Signature mismatch",
            recovered,
            address,
          },
          400,
        );
      }

      // （任意）ユーザー抽出：Authorization を付けていれば user を取得
      const authHeader = req.headers.get("authorization") ?? "";
      const supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id ?? null;

      // （任意）DB 反映：wallets テーブルに upsert（user スコープなら）
      if (userId) {
        const admin = createClient(supabaseUrl, serviceKey);
        await admin.from("wallets").upsert(
          { user_id: userId, address, verified: true },
          { onConflict: "user_id,address" },
        );
      }

      return json({ ok: true, recovered, linked_to: userId ?? null }, 200);
    } catch (e) {
      console.error("[verify-wallet-signature] fatal:", e);
      return json({ error: "Internal Error", message: String(e?.message ?? e) }, 500);
    }
  }

  return json({ error: "Method not allowed" }, 405);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}
