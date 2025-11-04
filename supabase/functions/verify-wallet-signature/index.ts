// supabase/functions/verify-wallet-signature/index.ts
// 最小構成：nonce 発行 / 署名検証 / wallets(user_id,address) だけ upsert
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, hashMessage, recoverAddress } from "https://esm.sh/viem@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  try {
    const { action } = await readBody(req);

    if (action === "nonce") {
      const nonce = crypto.randomUUID().replace(/-/g, "");
      return json({ nonce });
    }

    if (action === "verify") {
      const { address, signature, nonce } = await readBody(req);
      if (!isAddress(address) || typeof signature !== "string" || typeof nonce !== "string") {
        return json({ error: "Bad request" }, 400);
      }

      // JWT を通してユーザーとして実行
      const authHeader = req.headers.get("Authorization") || "";
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      // 署名の本人性
      const recovered = await recoverAddress({ hash: hashMessage(nonce), signature });
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return json({ error: "Signature does not match the address" }, 400);
      }

      // userId を取得（RLS前提）
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user?.id) {
        return json({ error: "Unauthorized" }, 401);
      }
      const userId = userData.user.id;

      // 最小列のみ upsert（他の列は書かない）
      const { error: upErr } = await supabase
        .from("wallets")
        .upsert(
          { user_id: userId, address: address.toLowerCase() },
          { onConflict: "user_id,address", ignoreDuplicates: false }
        );

      if (upErr) {
        // 典型：列不一致や RLS 違反の詳細を返す
        return json({ error: "upsert_failed", details: upErr }, 400);
      }

      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "internal_error", message: String(e?.message ?? e) }, 500);
  }
});

async function readBody(req: Request): Promise<any> {
  if (req.method === "GET") return {};
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
