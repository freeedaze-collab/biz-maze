// supabase/functions/verify-wallet-signature/index.ts
// ❗ edge-runtime の import は不要（削除済）

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAddress,
  recoverMessageAddress,
} from "https://esm.sh/viem@2?target=deno";

const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers":
    "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  vary: "origin",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors(origin) });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (req.method === "GET") {
      const nonce = crypto.randomUUID().replace(/-/g, "");
      return new Response(JSON.stringify({ nonce }), {
        status: 200,
        headers: { "content-type": "application/json", ...cors(origin) },
      });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: cors(origin),
      });
    }

    // Optional: Auth
    let userId: string | null = null;
    const authz =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (authz?.startsWith("Bearer ")) {
      const token = authz.slice("Bearer ".length);
      const { data: ures } = await supabase.auth.getUser(token);
      userId = ures?.user?.id ?? null;
    }

    const body = await req.json().catch(() => ({}));
    const action: string | undefined = body?.action;

    if (action !== "verify") {
      return new Response(JSON.stringify({ error: "Unsupported action" }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors(origin) },
      });
    }

    const address: string = body?.address;
    const signature: string = body?.signature;
    // message or nonce どちらでも受け取れるようにする
    const message: string | undefined =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.nonce === "string"
        ? body.nonce
        : undefined;

    if (!isAddress(address) || typeof signature !== "string" || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Bad request" }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors(origin) },
      });
    }

    const recovered = await recoverMessageAddress({ message, signature });

    console.info(
      `verify {\n  input: "${address}",\n  recovered: "${recovered}",\n  msg8: "${message.slice(
        0,
        8
      )}",\n  sigLen: ${signature.length}\n}\n`
    );

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return new Response(
        JSON.stringify({ ok: false, error: "Signature mismatch", recovered }),
        {
          status: 400,
          headers: { "content-type": "application/json", ...cors(origin) },
        }
      );
    }

    if (userId) {
      const { error } = await supabase
        .from("wallets")
        .upsert(
          {
            user_id: userId,
            address: address.toLowerCase(),
            verified: true,
          },
          { onConflict: "user_id,address" }
        );
      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: 500,
          headers: { "content-type": "application/json", ...cors(origin) },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json", ...cors(origin) },
    });
  } catch (e) {
    console.error("verify-wallet-signature error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "content-type": "application/json", ...cors(origin) },
    });
  }
});
