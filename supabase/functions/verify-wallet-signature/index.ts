// supabase/functions/verify-wallet-signature/index.ts
// Deno runtime / Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAddress,
  recoverAddress,
  hashMessage,
} from "https://esm.sh/viem@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

Deno.serve(async (req) => {
  // ---- CORS preflight ----
  if (req.method === "OPTIONS") return json({ ok: true }, 204);

  // ---- Supabase client (ユーザー権限を継承) ----
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  try {
    if (req.method === "GET") {
      // 互換: GET でも nonce を返す
      return json({ nonce: crypto.randomUUID().replace(/-/g, "") });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "nonce") {
      // 署名用ノンスを返す
      return json({ nonce: crypto.randomUUID().replace(/-/g, "") });
    }

    if (action === "verify") {
      const { address, signature, nonce } = body ?? {};

      if (
        typeof nonce !== "string" ||
        typeof signature !== "string" ||
        typeof address !== "string" ||
        !isAddress(address)
      ) {
        return json({ error: "Bad request" }, 400);
      }

      // 署名検証 (EIP-191 personal_sign 前提)
      const recovered = await recoverAddress({
        hash: hashMessage(nonce),
        signature,
      });

      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return json({ error: "Signature does not match the address" }, 400);
      }

      // サインイン中ユーザーを取得（RLS 通過に必須）
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        return json({ error: "Unauthorized" }, 401);
      }

      // wallets に upsert（スキーマの既存列に合わせる）
      const upsertPayload = {
        user_id: user.id,
        address: address,
        verified: true,
      };

      const { error: upsertErr } = await supabase
        .from("wallets")
        .upsert(upsertPayload, { onConflict: "user_id,address" });

      if (upsertErr) {
        return json({ error: upsertErr.message }, 400);
      }

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[verify-wallet-signature] fatal:", e);
    return json({ error: "Internal error" }, 500);
  }
});
